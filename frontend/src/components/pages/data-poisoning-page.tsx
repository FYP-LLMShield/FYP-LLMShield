import React, { useState } from "react";
import { scanHistoryAPI } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import {
  Database,
  Zap,
  Download,
  AlertTriangle,
  CheckCircle,
  Search,
  Loader,
  Shield,
  TrendingUp,
  Activity,
} from "lucide-react";

type ScanPhase = "setup" | "listing" | "file_selection" | "preview" | "scanning" | "results";

export interface Message {
  id: string;
  prompt: string;
  safeResponse: string | null;
  poisonResponse: string | null;
  generationTime: number;
}

interface ScanResult {
  success: boolean;
  total_rows: number;
  safe_count: number;
  poisoned_count: number;
  safe_percentage: number;
  poisoned_percentage: number;
  sample_rows: any[];
  error?: string;
}

interface HFFile {
  name: string;
  size?: number;
}

interface PreviewData {
  dataset_id: string;
  jsonl_file: string;
  total_rows: number;
  preview_rows: any[];
  preview_count: number;
}

export function DataPoisoningPage() {
  const [scanPhase, setScanPhase] = useState<ScanPhase>("setup");
  const [inputMode, setInputMode] = useState<"url" | "file">("url");
  const [modelUrl, setModelUrl] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // HuggingFace multi-step state
  const [hfFiles, setHFFiles] = useState<HFFile[]>([]);
  const [selectedHFFile, setSelectedHFFile] = useState<string>("");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [filePreviewData, setFilePreviewData] = useState<any>(null);
  const [listing, setListing] = useState(false);

  const listHFFiles = async () => {
    try {
      setError(null);
      if (!modelUrl.trim()) {
        setError("Please enter a HuggingFace dataset URL");
        return;
      }
      if (!modelUrl.includes("huggingface.co")) {
        setError("Please enter a valid HuggingFace URL (e.g., https://huggingface.co/datasets/user/dataset)");
        return;
      }

      setListing(true);
      setScanPhase("listing");

      const payload = {
        dataset_name: modelUrl.split("/").pop() || "dataset",
        huggingface_dataset_id: modelUrl,
      };

      console.log("Listing HF files with payload:", payload);

      const response = await fetch(
        `${process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1"}/dataset-poisoning/list/huggingface`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("List files error:", errorData);
        let errorMsg = "Failed to list files";
        if (errorData.detail) {
          errorMsg = errorData.detail;
        } else if (errorData.message) {
          errorMsg = errorData.message;
        } else if (errorData.errors) {
          errorMsg = JSON.stringify(errorData.errors);
        } else {
          errorMsg = JSON.stringify(errorData);
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const files = data.jsonl_files.map((name: string) => ({ name }));

      if (files.length === 0) {
        throw new Error("No JSONL, JSON, or Parquet files found in this dataset");
      }

      setHFFiles(files);
      setSelectedHFFile(files[0].name);
      setScanPhase("file_selection");
      setListing(false);
    } catch (err: any) {
      setError(err.message || "Failed to list files");
      setScanPhase("setup");
      setListing(false);
    }
  };

  const previewFile = async () => {
    try {
      setError(null);
      if (!uploadedFile) {
        setError("Please select a file");
        return;
      }

      setIsLoading(true);
      setScanPhase("preview");

      // Read file content for preview
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const lines = content.split('\n').filter(line => line.trim());

          // Parse first 10 rows based on file type
          const previewRows = [];
          for (let i = 0; i < Math.min(10, lines.length); i++) {
            try {
              if (uploadedFile.name.endsWith('.json') || uploadedFile.name.endsWith('.jsonl')) {
                previewRows.push(JSON.parse(lines[i]));
              } else if (uploadedFile.name.endsWith('.csv')) {
                previewRows.push(lines[i]);
              } else {
                previewRows.push(lines[i]);
              }
            } catch {
              previewRows.push(lines[i]);
            }
          }

          setFilePreviewData({
            filename: uploadedFile.name,
            total_rows: lines.length,
            preview_rows: previewRows,
            preview_count: previewRows.length
          });
          setIsLoading(false);
        } catch (err: any) {
          setError("Failed to preview file");
          setScanPhase("setup");
          setIsLoading(false);
        }
      };
      reader.onerror = () => {
        setError("Failed to read file");
        setScanPhase("setup");
        setIsLoading(false);
      };
      reader.readAsText(uploadedFile);
    } catch (err: any) {
      setError(err.message || "Failed to preview file");
      setScanPhase("setup");
      setIsLoading(false);
    }
  };

  const loadPreview = async () => {
    try {
      setError(null);
      if (!selectedHFFile) {
        setError("Please select a file");
        return;
      }

      setScanPhase("preview");
      setIsLoading(true);

      const token = localStorage.getItem("access_token") || localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication required. Please login first.");
      }

      const response = await fetch(
        `${process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1"}/dataset-poisoning/preview/huggingface`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dataset_name: modelUrl.split("/").pop() || "dataset",
            huggingface_dataset_id: modelUrl,
            text_content: selectedHFFile,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || errorData.message || JSON.stringify(errorData) || "Failed to load preview");
      }

      const preview = await response.json();
      setPreviewData(preview);
      setIsLoading(false);
    } catch (err: any) {
      setError(err.message || "Failed to load preview");
      setScanPhase("file_selection");
      setIsLoading(false);
    }
  };

  const startScan = async () => {
    try {
      setError(null);

      // Validate input based on mode
      if (inputMode === "url") {
        if (!selectedHFFile) {
          setError("Please select a file first");
          return;
        }
      } else {
        // File upload mode - should be in preview phase by now
        if (!uploadedFile || !filePreviewData) {
          setError("Please preview the file first");
          return;
        }
      }

      setScanPhase("scanning");
      setIsLoading(true);
      setScanProgress(0);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 15;
        });
      }, 300);

      const token = localStorage.getItem("access_token") || localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication required. Please login first.");
      }

      let response;

      if (inputMode === "url") {
        // URL mode - scan selected HF file with trained model
        response = await fetch(
          `${process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1"}/dataset-poisoning/scan/huggingface`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              dataset_name: modelUrl.split("/").pop() || "dataset",
              huggingface_dataset_id: modelUrl,
              jsonl_file: selectedHFFile,
            }),
          }
        );
      } else {
        // File upload mode - use scan/upload for BERT model results with sample rows
        const formData = new FormData();
        if (uploadedFile) {
          formData.append("file", uploadedFile);
        }

        response = await fetch(
          `${process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1"}/dataset-poisoning/scan/upload`,
          {
            method: "POST",
            body: formData,
            headers: token ? { "Authorization": `Bearer ${token}` } : {},
          }
        );
      }

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || errorData.message || JSON.stringify(errorData) || "Scan failed");
      }

      const result = await response.json();
      console.log("Scan result from backend:", result);
      setScanProgress(100);

      // Persist to MongoDB history
      try {
        const poisoned = result.poisoned_count ?? (result.is_poisoned ? 1 : 0)
        await scanHistoryAPI.saveHistory({
          scan_id: result.scan_id || `dp-${Date.now()}`,
          scan_type: "data_poisoning",
          title: `Data Poisoning · ${new Date().toLocaleTimeString()}`,
          status: poisoned > 0 ? "warning" : "success",
          total_findings: poisoned,
          high_findings: poisoned,
          medium_findings: 0,
          low_findings: 0,
          input_type: inputMode === "url" ? "json" : "file",
          input_size: 0,
          scan_results: result,
          executive_summary: poisoned > 0 ? "High" : "Safe",
          description: `Scan at ${new Date().toISOString()}`,
        })
      } catch (histErr) {
        console.warn("History save failed (non-critical):", histErr)
      }

      setTimeout(() => {
        setScanResult(result);
        setScanPhase("results");
        setIsLoading(false);
      }, 500);

    } catch (err: any) {
      setError(err.message || "An error occurred during scanning");
      setScanPhase(inputMode === "url" ? "preview" : "setup");
      setIsLoading(false);
    }
  };

  const resetScan = () => {
    setScanPhase("setup");
    setScanProgress(0);
    setScanResult(null);
    setError(null);
    setModelUrl("");
    setUploadedFile(null);
    setHFFiles([]);
    setSelectedHFFile("");
    setPreviewData(null);
    setFilePreviewData(null);
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case "safe":
        return "bg-green-600 hover:bg-green-700";
      case "suspicious":
        return "bg-yellow-600 hover:bg-yellow-700";
      case "unsafe":
        return "bg-red-600 hover:bg-red-700";
      default:
        return "bg-gray-600 hover:bg-gray-700";
    }
  };

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case "safe":
        return <CheckCircle className="w-4 h-4" />;
      case "suspicious":
        return <AlertTriangle className="w-4 h-4" />;
      case "unsafe":
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Database className="w-4 h-4" />;
    }
  };

  const downloadReport = (format: string) => {
    if (!scanResult) return;

    try {
      let content = "";
      let filename = `data-poisoning-report-${new Date().toISOString().slice(0, 10)}`;

      if (format === "json") {
        content = JSON.stringify(scanResult, null, 2);
        filename += ".json";
        const blob = new Blob([content], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      setError(`Failed to download report: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-gradient-to-br from-blue-500/30 to-indigo-500/20 rounded-lg border border-blue-400/50 shadow-lg shadow-blue-500/20">
                  <Database className="w-7 h-7 text-blue-600 dark:text-blue-300" />
                </div>
                <div>
                  <h1 className="text-5xl font-bold gradient-text-cyber mb-2 animate-pulse-glow" style={{lineHeight: '1.1', paddingBottom: '4px'}}>
                    Data Poisoning Detection
                  </h1>
                  <p className="text-slate-600 dark:text-gray-300 text-base font-semibold">MultiTaskBERT scan for Hugging Face datasets</p>
                </div>
              </div>
              <p className="text-slate-600 dark:text-gray-400 text-sm ml-0 max-w-2xl">Upload a dataset or pick a JSONL, JSON, or Parquet file from the Hub; each row is classified as safe or poisoned, then aggregated into risk scores.</p>
            </div>
            {scanPhase !== "setup" && (
              <Button
                onClick={resetScan}
                className="ml-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
              >
                <Zap className="mr-2 h-5 w-5" />
                New Scan
              </Button>
            )}
          </div>
        </div>

        {/* Setup Phase */}
        {scanPhase === "setup" && (
          <div className="space-y-6">
            {error && (
              <div className="bg-red-950/50 border-2 border-red-500/60 rounded-xl p-6 backdrop-blur-md shadow-xl shadow-red-500/20">
                <div className="flex items-start space-x-4">
                  <AlertTriangle className="h-8 w-8 text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-red-300 font-bold text-lg">⚠️ Error During Scan</span>
                    <p className="text-red-200 mt-2 text-base">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Input Card - Larger */}
              <div className="lg:col-span-2">
                <Card className="h-full border-2 border-border bg-card text-card-foreground shadow-lg dark:border-blue-500/60 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 dark:shadow-2xl dark:shadow-blue-500/30">
                  <CardHeader className="pb-6 border-b border-border bg-muted dark:border-blue-500/40 dark:bg-gradient-to-r dark:from-blue-950/50 dark:to-transparent">
                    <CardTitle className="text-3xl font-bold flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-blue-500/25 to-indigo-500/20 rounded-lg dark:from-blue-500/40 dark:to-indigo-500/30">
                        <Search className="w-7 h-7 text-blue-600 dark:text-blue-300" />
                      </div>
                      Scan Configuration
                    </CardTitle>
                    <p className="text-muted-foreground text-base mt-3 font-medium">Choose how to provide your dataset</p>

                    {/* Tabs */}
                    <div className="flex gap-2 mt-6 border-b border-border dark:border-blue-500/20">
                      <button
                        onClick={() => setInputMode("url")}
                        className={`px-4 py-2 font-semibold transition-all border-b-2 ${
                          inputMode === "url"
                            ? "border-blue-600 text-blue-800 dark:border-blue-500 dark:text-blue-300"
                            : "border-transparent text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-gray-300"
                        }`}
                      >
                        🔗 HuggingFace URL
                      </button>
                      <button
                        onClick={() => setInputMode("file")}
                        className={`px-4 py-2 font-semibold transition-all border-b-2 ${
                          inputMode === "file"
                            ? "border-blue-600 text-blue-800 dark:border-blue-500 dark:text-blue-300"
                            : "border-transparent text-muted-foreground hover:text-foreground dark:text-gray-400 dark:hover:text-gray-300"
                        }`}
                      >
                        📁 Upload File
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-8 pt-8">
                    {/* URL Mode */}
                    {inputMode === "url" && (
                      <div className="space-y-4">
                        <Label className="text-base font-semibold block">🔗 HuggingFace Dataset URL</Label>
                        <div className="relative group">
                          <Input
                            value={modelUrl}
                            onChange={(e) => setModelUrl(e.target.value)}
                            placeholder="https://huggingface.co/datasets/user/dataset"
                            className="llm-hf-url-input w-full rounded-lg border border-neutral-200 py-3 px-4 shadow-xs transition-all duration-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                        <p className="text-muted-foreground text-sm flex items-center gap-2">
                          <span>💡</span>
                          Example: https://huggingface.co/datasets/rajpurkar/squad (Parquet splits under plain_text/)
                        </p>
                      </div>
                    )}

                    {/* File Upload Mode */}
                    {inputMode === "file" && (
                      <div className="space-y-4">
                        <Label className="text-base font-semibold block">📁 Upload Dataset File</Label>
                        <div className="relative group">
                          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-blue-500 transition-all cursor-pointer dark:border-blue-500/50 dark:hover:border-blue-400"
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.add("border-blue-400", "bg-blue-500/10");
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove("border-blue-400", "bg-blue-500/10");
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.currentTarget.classList.remove("border-blue-400", "bg-blue-500/10");
                              const files = e.dataTransfer.files;
                              if (files.length > 0) {
                                setUploadedFile(files[0]);
                              }
                            }}
                            onClick={() => document.getElementById("file-input")?.click()}
                          >
                            {uploadedFile ? (
                              <>
                                <p className="text-green-700 dark:text-green-400 font-semibold text-lg">✓ File Selected</p>
                                <p className="text-foreground text-sm mt-2">{uploadedFile.name}</p>
                                <p className="text-muted-foreground text-xs mt-1">({(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB)</p>
                              </>
                            ) : (
                              <>
                                <p className="text-foreground dark:text-gray-300 font-semibold mb-2">Drag and drop your file here</p>
                                <p className="text-muted-foreground text-sm">or click to browse</p>
                              </>
                            )}
                            <input
                              id="file-input"
                              type="file"
                              accept=".json,.jsonl,.csv,.txt,.parquet"
                              onChange={(e) => {
                                if (e.target.files?.length) {
                                  setUploadedFile(e.target.files[0]);
                                }
                              }}
                              className="hidden"
                            />
                          </div>
                        </div>
                        <p className="text-muted-foreground text-sm flex items-center gap-2">
                          <span>📋</span>
                          Supported formats: JSON, JSONL, CSV, TXT, Parquet
                        </p>
                      </div>
                    )}

                  </CardContent>
                </Card>
              </div>

              {/* Features & CTA Card */}
              <div className="lg:col-span-1">
                <div className="space-y-6 h-full flex flex-col">
                  <Card className="flex-1 border-2 border-border bg-card text-card-foreground shadow-lg dark:border-indigo-500/60 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 dark:shadow-xl dark:shadow-indigo-500/20">
                    <CardHeader className="pb-4 border-b border-border bg-muted dark:border-indigo-500/40 dark:bg-gradient-to-r dark:from-indigo-950/50 dark:to-transparent">
                      <CardTitle className="text-lg font-bold flex items-center gap-2 dark:text-blue-100">
                        <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        What We Check
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      <div className="p-4 rounded-lg border border-border bg-muted hover:border-blue-400/80 transition-all dark:bg-gradient-to-br dark:from-blue-950/50 dark:to-blue-900/30 dark:border-blue-500/40 dark:hover:border-blue-400">
                        <p className="font-semibold mb-2 text-sm flex items-center gap-2 dark:text-blue-200">
                          <Activity className="w-4 h-4" /> Row extraction
                        </p>
                        <p className="text-muted-foreground dark:text-gray-300 text-xs">Parse JSONL/CSV and pull text fields per row</p>
                      </div>
                      <div className="p-4 rounded-lg border border-border bg-muted hover:border-indigo-400/80 transition-all dark:bg-gradient-to-br dark:from-indigo-950/50 dark:to-indigo-900/30 dark:border-indigo-500/40 dark:hover:border-indigo-400">
                        <p className="font-semibold mb-2 text-sm flex items-center gap-2 dark:text-indigo-200">
                          <TrendingUp className="w-4 h-4" /> BERT classification
                        </p>
                        <p className="text-muted-foreground dark:text-gray-300 text-xs">MultiTaskBERT labels each row Safe vs Poisoned</p>
                      </div>
                      <div className="p-4 rounded-lg border border-border bg-muted hover:border-purple-400/80 transition-all dark:bg-gradient-to-br dark:from-purple-950/50 dark:to-purple-900/30 dark:border-purple-500/40 dark:hover:border-purple-400">
                        <p className="font-semibold mb-2 text-sm flex items-center gap-2 dark:text-purple-200">
                          <AlertTriangle className="w-4 h-4" /> Aggregate risk
                        </p>
                        <p className="text-muted-foreground dark:text-gray-300 text-xs">Counts, percentages, and sample rows</p>
                      </div>
                    </CardContent>
                  </Card>

                  {inputMode === "url" ? (
                    <Button
                      onClick={listHFFiles}
                      disabled={listing || !modelUrl.trim()}
                      className="w-full h-14 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:via-indigo-700 hover:to-blue-700 text-white shadow-xl hover:shadow-blue-500/50 transition-all duration-300 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                    >
                      <Search className="mr-2 h-5 w-5" />
                      {listing ? "Listing Files..." : "List Available Files"}
                    </Button>
                  ) : (
                    <Button
                      onClick={previewFile}
                      disabled={isLoading || !uploadedFile}
                      className="w-full h-14 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:via-indigo-700 hover:to-blue-700 text-white shadow-xl hover:shadow-blue-500/50 transition-all duration-300 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                    >
                      <Search className="mr-2 h-5 w-5" />
                      {isLoading ? "Loading Preview..." : "Load Preview"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* File Selection Phase */}
        {scanPhase === "file_selection" && (
          <div className="space-y-6">
            {error && (
              <div className="bg-red-950/50 border-2 border-red-500/60 rounded-xl p-6 backdrop-blur-md shadow-xl shadow-red-500/20">
                <div className="flex items-start space-x-4">
                  <AlertTriangle className="h-8 w-8 text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-red-300 font-bold text-lg">⚠️ Error</span>
                    <p className="text-red-200 mt-2 text-base">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className="border-2 border-border bg-card text-card-foreground shadow-lg dark:border-blue-500/60 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 dark:shadow-2xl dark:shadow-blue-500/30">
                  <CardHeader className="pb-6 border-b border-border bg-muted dark:border-blue-500/40 dark:bg-gradient-to-r dark:from-blue-950/50 dark:to-transparent">
                    <CardTitle className="text-3xl font-bold flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-blue-500/25 to-indigo-500/20 rounded-lg dark:from-blue-500/40 dark:to-indigo-500/30">
                        <Database className="w-7 h-7 text-blue-600 dark:text-blue-300" />
                      </div>
                      Select Dataset File
                    </CardTitle>
                    <p className="text-muted-foreground text-base mt-3 font-medium">Choose which file to analyze</p>
                  </CardHeader>
                  <CardContent className="space-y-8 pt-8">
                    <div className="space-y-4">
                      <Label className="text-base font-semibold block">📂 Available Files</Label>
                      <select
                        value={selectedHFFile}
                        onChange={(e) => setSelectedHFFile(e.target.value)}
                        className="llm-hf-url-input w-full rounded-lg border border-neutral-200 py-3 px-4 transition-all duration-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      >
                        {hfFiles.map(file => (
                          <option key={file.name} value={file.name}>
                            {file.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-muted-foreground dark:text-gray-400 text-sm">{hfFiles.length} file(s) found in this dataset</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1">
                <div className="space-y-6 h-full flex flex-col">
                  <Card className="flex-1 border-2 border-border bg-card text-card-foreground shadow-lg dark:border-indigo-500/60 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 dark:shadow-xl dark:shadow-indigo-500/20">
                    <CardHeader className="pb-4 border-b border-border bg-muted dark:border-indigo-500/40 dark:bg-gradient-to-r dark:from-indigo-950/50 dark:to-transparent">
                      <CardTitle className="text-lg font-bold dark:text-blue-100">📋 Next Step</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      <p className="text-muted-foreground dark:text-gray-300 text-sm">Select a file and click "Load Preview" to see sample data before scanning.</p>
                    </CardContent>
                  </Card>

                  <Button
                    onClick={loadPreview}
                    disabled={isLoading || !selectedHFFile}
                    className="w-full h-14 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:via-indigo-700 hover:to-blue-700 text-white shadow-xl hover:shadow-blue-500/50 transition-all duration-300 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                  >
                    <Search className="mr-2 h-5 w-5" />
                    {isLoading ? "Loading Preview..." : "Load Preview"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preview Phase - File Upload */}
        {scanPhase === "preview" && inputMode === "file" && filePreviewData && (
          <div className="space-y-6">
            {error && (
              <div className="bg-red-950/50 border-2 border-red-500/60 rounded-xl p-6 backdrop-blur-md shadow-xl shadow-red-500/20">
                <div className="flex items-start space-x-4">
                  <AlertTriangle className="h-8 w-8 text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-red-300 font-bold text-lg">⚠️ Error</span>
                    <p className="text-red-200 mt-2 text-base">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className="border-2 border-border bg-card text-card-foreground shadow-lg dark:border-blue-500/60 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 dark:shadow-2xl dark:shadow-blue-500/30">
                  <CardHeader className="pb-6 border-b border-border bg-muted dark:border-blue-500/40 dark:bg-gradient-to-r dark:from-blue-950/50 dark:to-transparent">
                    <CardTitle className="text-3xl font-bold flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-blue-500/25 to-indigo-500/20 rounded-lg dark:from-blue-500/40 dark:to-indigo-500/30">
                        <Search className="w-7 h-7 text-blue-600 dark:text-blue-300" />
                      </div>
                      File Preview
                    </CardTitle>
                    <p className="text-muted-foreground text-base mt-3 font-medium">Review sample rows before scanning</p>
                  </CardHeader>
                  <CardContent className="space-y-8 pt-8">
                    <div className="space-y-4">
                      <div className="rounded-lg border border-border bg-muted p-6 dark:bg-blue-950/30 dark:border-blue-500/40">
                        <h3 className="text-base font-semibold mb-4 dark:text-blue-200">📋 {filePreviewData.filename} - {filePreviewData.preview_count} of {filePreviewData.total_rows} rows</h3>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {filePreviewData.preview_rows.map((row: any, idx: number) => (
                            <div key={idx} className="rounded border border-border bg-background p-3 dark:bg-slate-800/50 dark:border-slate-600/30">
                              <p className="text-sm font-mono whitespace-pre-wrap break-words text-foreground dark:text-gray-300">
                                {typeof row === 'string' ? row : JSON.stringify(row, null, 2).substring(0, 300)}
                              </p>
                            </div>
                          ))}
                        </div>
                        <p className="text-muted-foreground dark:text-gray-400 text-xs mt-3">Total rows in file: {filePreviewData.total_rows}</p>
                      </div>

                      <div className="space-y-2 border-t border-border dark:border-blue-500/30 pt-8">
                        <p className="text-sm text-muted-foreground dark:text-gray-400">
                          <span className="font-semibold text-foreground dark:text-gray-200">Next:</span> Start Scan runs the backend MultiTaskBERT classifier on extracted text (no optional modes).
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1">
                <div className="space-y-6 h-full flex flex-col">
                  <Card className="flex-1 border-2 border-border bg-card text-card-foreground shadow-lg dark:border-indigo-500/60 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 dark:shadow-xl dark:shadow-indigo-500/20">
                    <CardHeader className="pb-4 border-b border-border bg-muted dark:border-indigo-500/40 dark:bg-gradient-to-r dark:from-indigo-950/50 dark:to-transparent">
                      <CardTitle className="text-lg font-bold flex items-center gap-2 dark:text-blue-100">
                        <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        BERT Model Scan
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      <div className="rounded-lg border border-border bg-muted p-4 dark:bg-gradient-to-br dark:from-blue-950/50 dark:to-blue-900/30 dark:border-blue-500/40">
                        <p className="font-semibold mb-2 text-sm flex items-center gap-2 dark:text-blue-200">
                          🤖 BERT Poisoning Detection
                        </p>
                        <p className="text-muted-foreground dark:text-gray-300 text-xs">Analyze dataset with trained model</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Button
                    onClick={startScan}
                    disabled={isLoading}
                    className="w-full h-14 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:via-indigo-700 hover:to-blue-700 text-white shadow-xl hover:shadow-blue-500/50 transition-all duration-300 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                  >
                    <Search className="mr-2 h-5 w-5" />
                    {isLoading ? "Scanning..." : "Start Scan"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preview Phase - HuggingFace */}
        {scanPhase === "preview" && inputMode === "url" && (
          <div className="space-y-6">
            {error && (
              <div className="bg-red-950/50 border-2 border-red-500/60 rounded-xl p-6 backdrop-blur-md shadow-xl shadow-red-500/20">
                <div className="flex items-start space-x-4">
                  <AlertTriangle className="h-8 w-8 text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-red-300 font-bold text-lg">⚠️ Error</span>
                    <p className="text-red-200 mt-2 text-base">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className="border-2 border-border bg-card text-card-foreground shadow-lg dark:border-blue-500/60 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 dark:shadow-2xl dark:shadow-blue-500/30">
                  <CardHeader className="pb-6 border-b border-border bg-muted dark:border-blue-500/40 dark:bg-gradient-to-r dark:from-blue-950/50 dark:to-transparent">
                    <CardTitle className="text-3xl font-bold flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-blue-500/25 to-indigo-500/20 rounded-lg dark:from-blue-500/40 dark:to-indigo-500/30">
                        <Search className="w-7 h-7 text-blue-600 dark:text-blue-300" />
                      </div>
                      Data Preview
                    </CardTitle>
                    <p className="text-muted-foreground text-base mt-3 font-medium">Review sample rows before scanning</p>
                  </CardHeader>
                  <CardContent className="space-y-8 pt-8">
                    {previewData && (
                      <div className="space-y-4">
                        <div className="rounded-lg border border-border bg-muted p-6 dark:bg-blue-950/30 dark:border-blue-500/40">
                          <h3 className="text-base font-semibold mb-4 dark:text-blue-200">📋 {previewData.jsonl_file} - {previewData.preview_count} of {previewData.total_rows} rows</h3>
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {previewData.preview_rows.map((row, idx) => (
                              <div key={idx} className="rounded border border-border bg-background p-3 dark:bg-slate-800/50 dark:border-slate-600/30">
                                <p className="text-sm font-mono whitespace-pre-wrap break-words text-foreground dark:text-gray-300">
                                  {typeof row === 'string' ? row : JSON.stringify(row, null, 2).substring(0, 300)}
                                </p>
                              </div>
                            ))}
                          </div>
                          <p className="text-muted-foreground dark:text-gray-400 text-xs mt-3">Total rows in file: {previewData.total_rows}</p>
                        </div>

                        <div className="space-y-2 border-t border-border dark:border-blue-500/30 pt-8">
                          <p className="text-sm text-muted-foreground dark:text-gray-400">
                            <span className="font-semibold text-foreground dark:text-gray-200">Scan:</span> The server loads the selected file and classifies each extracted row with MultiTaskBERT (same path whether you preview here or not).
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1">
                <div className="space-y-6 h-full flex flex-col">
                  <Card className="flex-1 border-2 border-border bg-card text-card-foreground shadow-lg dark:border-indigo-500/60 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 dark:shadow-xl dark:shadow-indigo-500/20">
                    <CardHeader className="pb-4 border-b border-border bg-muted dark:border-indigo-500/40 dark:bg-gradient-to-r dark:from-indigo-950/50 dark:to-transparent">
                      <CardTitle className="text-lg font-bold flex items-center gap-2 dark:text-blue-100">
                        <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        BERT Model Scan
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      <div className="rounded-lg border border-border bg-muted p-4 dark:bg-gradient-to-br dark:from-blue-950/50 dark:to-blue-900/30 dark:border-blue-500/40">
                        <p className="font-semibold mb-2 text-sm flex items-center gap-2 dark:text-blue-200">
                          🤖 BERT Poisoning Detection
                        </p>
                        <p className="text-muted-foreground dark:text-gray-300 text-xs">Analyze dataset for data poisoning</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Button
                    onClick={startScan}
                    disabled={isLoading}
                    className="w-full h-14 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:via-indigo-700 hover:to-blue-700 text-white shadow-xl hover:shadow-blue-500/50 transition-all duration-300 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                  >
                    <Search className="mr-2 h-5 w-5" />
                    {isLoading ? "Scanning..." : "Start Scan"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Listing Files Phase */}
        {scanPhase === "listing" && (
          <div className="animate-fadeIn">
            <Card className="border-2 border-border bg-card text-card-foreground shadow-lg dark:border-blue-500/60 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 dark:shadow-2xl dark:shadow-blue-500/40">
              <CardHeader className="pb-8 border-b border-border bg-muted dark:border-blue-500/40 dark:bg-gradient-to-r dark:from-blue-950/50 dark:to-transparent">
                <CardTitle className="mb-3 flex items-center gap-3 text-3xl font-bold">
                  <div className="p-2 bg-gradient-to-br from-blue-500/25 to-indigo-500/20 rounded-lg dark:from-blue-500/40 dark:to-indigo-500/30">
                    <Loader className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-300" />
                  </div>
                  Fetching Dataset Files
                </CardTitle>
                <p className="mt-2 text-lg font-semibold text-muted-foreground dark:text-blue-100">Scanning HuggingFace dataset for available files...</p>
              </CardHeader>
              <CardContent className="space-y-8 pt-8">
                <div className="flex justify-center py-12">
                  <div className="relative w-32 h-32 flex items-center justify-center">
                    <div className="absolute w-32 h-32 border-4 border-blue-200 rounded-full animate-spin dark:border-blue-500/30" style={{animationDuration: "3s"}}></div>
                    <div className="absolute w-24 h-24 border-4 border-indigo-300 rounded-full animate-spin dark:border-indigo-500/50" style={{animationDuration: "2s", animationDirection: "reverse"}}></div>
                    <Database className="h-8 w-8 text-blue-600 dark:text-blue-300" />
                  </div>
                </div>
                <p className="text-center text-lg text-muted-foreground dark:text-gray-300">Listing JSON and Parquet files...</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Scanning Phase */}
        {scanPhase === "scanning" && (
          <div className="animate-fadeIn">
            <Card className="border-2 border-border bg-card text-card-foreground shadow-lg dark:border-blue-500/60 dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 dark:shadow-2xl dark:shadow-blue-500/40">
              <CardHeader className="pb-8 border-b border-border bg-muted dark:border-blue-500/40 dark:bg-gradient-to-r dark:from-blue-950/50 dark:to-transparent">
                <CardTitle className="mb-3 flex items-center gap-3 text-3xl font-bold">
                  <div className="p-2 bg-gradient-to-br from-blue-500/25 to-indigo-500/20 rounded-lg dark:from-blue-500/40 dark:to-indigo-500/30">
                    <Loader className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-300" />
                  </div>
                  Analyzing Dataset with BERT Model
                </CardTitle>
                <p className="mt-2 text-lg font-semibold text-muted-foreground dark:text-blue-100">Running poisoning detection with trained BERT model...</p>
              </CardHeader>
              <CardContent className="space-y-8 pt-8">
                {/* Progress Circle */}
                <div className="flex justify-center py-12">
                  <div className="relative w-56 h-56 flex items-center justify-center">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" strokeWidth="3" className="stroke-slate-300 dark:stroke-blue-900" />
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="url(#grad1)"
                        strokeWidth="4"
                        strokeDasharray={`${282.7 * (scanProgress / 100)} 282.7`}
                        strokeLinecap="round"
                        className="transition-all duration-300"
                        transform="rotate(-90 50 50)"
                      />
                      <defs>
                        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#6366f1" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute text-center">
                      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-7xl font-black text-transparent dark:from-blue-400 dark:to-indigo-400">
                        {scanProgress}%
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-800 dark:text-blue-300">classifying rows</div>
                    </div>
                  </div>
                </div>

                {/* Status Messages */}
                <div className="space-y-4 py-8">
                  <div className={`flex items-start gap-3 rounded-lg border p-4 transition-all ${scanProgress >= 30 ? "border-blue-300 bg-blue-500/10 dark:bg-blue-500/15 dark:border-blue-500/40" : "border-border bg-muted dark:bg-slate-500/10 dark:border-slate-500/30"}`}>
                    <div className="text-lg">{scanProgress >= 30 ? "✓" : "○"}</div>
                    <div className="flex-1">
                      <p className={`font-medium ${scanProgress >= 30 ? "text-blue-600 dark:text-blue-300" : "text-muted-foreground dark:text-gray-300"}`}>Parse & extract text</p>
                      <p className="text-sm text-muted-foreground dark:text-gray-400">{scanProgress >= 30 ? "✓ Reading rows and pulling text fields" : "Pending..."}</p>
                    </div>
                  </div>
                  <div className={`flex items-start gap-3 rounded-lg border p-4 transition-all ${scanProgress >= 60 ? "border-blue-300 bg-blue-500/10 dark:bg-blue-500/15 dark:border-blue-500/40" : "border-border bg-muted dark:bg-slate-500/10 dark:border-slate-500/30"}`}>
                    <div className="text-lg">{scanProgress >= 60 ? "✓" : "○"}</div>
                    <div className="flex-1">
                      <p className={`font-medium ${scanProgress >= 60 ? "text-blue-600 dark:text-blue-300" : "text-muted-foreground dark:text-gray-300"}`}>BERT inference</p>
                      <p className="text-sm text-muted-foreground dark:text-gray-400">{scanProgress >= 60 ? "✓ Safe vs poisoned per row" : "Pending..."}</p>
                    </div>
                  </div>
                  <div className={`flex items-start gap-3 rounded-lg border p-4 transition-all ${scanProgress >= 85 ? "border-blue-300 bg-blue-500/10 dark:bg-blue-500/15 dark:border-blue-500/40" : "border-border bg-muted dark:bg-slate-500/10 dark:border-slate-500/30"}`}>
                    <div className="text-lg">{scanProgress >= 85 ? "✓" : "○"}</div>
                    <div className="flex-1">
                      <p className={`font-medium ${scanProgress >= 85 ? "text-blue-600 dark:text-blue-300" : "text-muted-foreground dark:text-gray-300"}`}>Aggregate results</p>
                      <p className="text-sm text-muted-foreground dark:text-gray-400">{scanProgress >= 85 ? "✓ Counts, percentages, samples" : "Pending..."}</p>
                    </div>
                  </div>
                </div>

                <p className="text-center text-sm italic text-muted-foreground dark:text-gray-400">
                  This may take a few minutes depending on model size...
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results Phase */}
        {scanPhase === "results" && scanResult && (
          <div className="space-y-8 animate-fadeIn">
            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3">
              <Button
                onClick={resetScan}
                className="border-cyan-600 bg-cyan-50 text-cyan-900 hover:bg-cyan-100 dark:border-cyan-500/50 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500/20 backdrop-blur-md hover-lift transition-all"
              >
                <Zap className="w-4 h-4 mr-2" />
                New Scan
              </Button>
              <Button
                onClick={() => downloadReport("json")}
                className="border-blue-600 bg-blue-50 text-blue-900 hover:bg-blue-100 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20 backdrop-blur-md hover-lift transition-all"
              >
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
            </div>

            {/* Scan Results Card */}
            <Card className="glass-card overflow-hidden border-2 border-border bg-card text-card-foreground shadow-lg dark:border-cyan-500/40 dark:bg-gradient-to-br dark:from-slate-900/80 dark:to-slate-800/50 dark:shadow-lg dark:shadow-cyan-500/20">
              <div className={`bg-gradient-to-r ${
                (scanResult.poisoned_count || 0) === 0
                  ? "from-emerald-600/25 to-cyan-600/20 border-emerald-500/30"
                  : (scanResult.poisoned_percentage || 0) > 50
                  ? "from-red-600/25 to-orange-600/20 border-red-500/30"
                  : "from-yellow-600/25 to-amber-600/20 border-yellow-500/30"
              } border-b px-8 py-8`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-4">
                      <Badge className={`${
                        (scanResult.poisoned_count || 0) === 0
                          ? "bg-green-600 hover:bg-green-700"
                          : (scanResult.poisoned_percentage || 0) > 50
                          ? "bg-red-600 hover:bg-red-700"
                          : "bg-yellow-600 hover:bg-yellow-700"
                      } text-white flex items-center gap-2 px-4 py-2 text-lg`}>
                        {(scanResult.poisoned_count || 0) === 0 ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        {(scanResult.poisoned_count || 0) === 0 ? "SAFE" : "POISONING DETECTED"}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground dark:text-gray-300">Poisoning Risk:</span>
                        <div className="h-2 w-48 overflow-hidden rounded-full bg-slate-200 dark:bg-gray-700/50">
                          <div
                            className={`h-full ${
                              (scanResult.poisoned_count || 0) === 0
                                ? "bg-green-500"
                                : (scanResult.poisoned_percentage || 0) > 50
                                ? "bg-red-500"
                                : "bg-yellow-500"
                            }`}
                            style={{ width: `${(scanResult.poisoned_percentage || 0)}%` }}
                          />
                        </div>
                        <span className="min-w-12 font-bold">{Math.round(scanResult.poisoned_percentage || 0)}%</span>
                      </div>
                    </div>
                    <div>
                      <h2 className="mb-2 text-3xl font-bold">🤖 BERT Analysis Results</h2>
                      <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground dark:text-gray-300">Scanned {scanResult.total_rows || 0} rows with trained BERT model for data poisoning detection</p>
                    </div>
                  </div>
                </div>
              </div>

              <CardContent className="space-y-8 pt-8">
                {/* Scan Statistics */}
                <div className="space-y-6 border-t border-border pt-8 dark:border-cyan-500/20">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/15 p-2 dark:from-blue-500/30 dark:to-cyan-500/20">
                      <Activity className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-bold">Detection Results</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Total Rows */}
                    <div className="group cursor-default rounded-xl border border-blue-200 bg-blue-50/80 p-5 shadow-md shadow-blue-500/10 transition-all hover:border-blue-400 dark:border-blue-500/30 dark:bg-gradient-to-br dark:from-blue-500/15 dark:to-blue-600/5 dark:shadow-lg dark:hover:border-blue-500/50">
                      <div className="mb-4 flex items-center justify-between">
                        <label className="text-sm font-bold text-slate-900 dark:text-gray-200">Total Rows</label>
                        <div className="text-2xl font-bold text-blue-700 transition-transform group-hover:scale-110 dark:text-blue-400">{scanResult.total_rows || 0}</div>
                      </div>
                      <p className="mt-3 text-xs font-medium text-slate-800 dark:text-gray-300">Rows analyzed</p>
                    </div>

                    {/* Safe Rows */}
                    <div className="group cursor-default rounded-xl border border-green-200 bg-green-50/80 p-5 shadow-md shadow-green-500/10 transition-all hover:border-green-400 dark:border-green-500/30 dark:bg-gradient-to-br dark:from-green-500/15 dark:to-emerald-600/5 dark:shadow-lg dark:hover:border-green-500/50">
                      <div className="mb-4 flex items-center justify-between">
                        <label className="text-sm font-bold text-slate-900 dark:text-gray-200">Safe Rows</label>
                        <div className="text-2xl font-bold text-green-700 transition-transform group-hover:scale-110 dark:text-green-400">{scanResult.safe_count || 0}</div>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full border border-green-200 bg-slate-200 dark:border-green-500/20 dark:bg-slate-700/50">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                          style={{ width: `${(scanResult.safe_percentage || 0)}%` }}
                        />
                      </div>
                      <p className="mt-3 text-xs font-medium text-slate-800 dark:text-gray-300">{Math.round(scanResult.safe_percentage || 0)}% safe</p>
                    </div>

                    {/* Poisoned Rows */}
                    <div className="group cursor-default rounded-xl border border-red-200 bg-red-50/80 p-5 shadow-md shadow-red-500/10 transition-all hover:border-red-400 dark:border-red-500/30 dark:bg-gradient-to-br dark:from-red-500/15 dark:to-orange-600/5 dark:shadow-lg dark:hover:border-red-500/50">
                      <div className="mb-4 flex items-center justify-between">
                        <label className="text-sm font-bold text-slate-900 dark:text-gray-200">Poisoned Rows</label>
                        <div className="text-2xl font-bold text-red-700 transition-transform group-hover:scale-110 dark:text-red-400">{scanResult.poisoned_count || 0}</div>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full border border-red-200 bg-slate-200 dark:border-red-500/20 dark:bg-slate-700/50">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-red-500 via-orange-500 to-red-600 transition-all duration-500"
                          style={{ width: `${(scanResult.poisoned_percentage || 0)}%` }}
                        />
                      </div>
                      <p className="mt-3 text-xs font-medium text-slate-800 dark:text-gray-300">{Math.round(scanResult.poisoned_percentage || 0)}% poisoned</p>
                    </div>
                  </div>
                </div>

                {/* Sample Poisoned Rows */}
                {scanResult.sample_rows && scanResult.sample_rows.length > 0 && (
                  <div className="space-y-6 border-t border-border pt-8 dark:border-cyan-500/20">
                    <div className="mb-6 flex items-center gap-3">
                      <div className="rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/15 p-2 dark:from-red-500/30 dark:to-orange-500/20">
                        <AlertTriangle className="h-5 w-5 text-red-700 dark:text-red-400" />
                      </div>
                      <h3 className="text-2xl font-bold">Sample Poisoned Rows</h3>
                    </div>

                    <div className="space-y-3">
                      {scanResult.sample_rows.slice(0, 5).map((row, idx) => (
                        <div key={idx} className="flex items-start gap-4 rounded-lg border border-red-300 bg-red-50/90 p-4 transition-all hover:border-red-400 dark:border-red-500/40 dark:bg-gradient-to-r dark:from-red-900/20 dark:to-slate-700/30 dark:hover:border-red-500/60 dark:hover:bg-red-900/30">
                          <div className="mt-0.5 flex-shrink-0 text-2xl">⚠️</div>
                          <div className="flex-1 break-words">
                            <p className="text-sm font-mono leading-relaxed text-red-900 whitespace-pre-wrap dark:text-red-200">
                              {typeof row === 'string' ? row : JSON.stringify(row, null, 2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {scanResult.sample_rows.length > 5 && (
                      <p className="text-center text-sm text-slate-700 dark:text-gray-400">... and {scanResult.sample_rows.length - 5} more poisoned rows</p>
                    )}
                  </div>
                )}

              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default DataPoisoningPage;
