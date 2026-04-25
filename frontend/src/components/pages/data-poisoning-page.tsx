import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Switch } from "../ui/switch";
import {
  Database,
  Zap,
  Download,
  AlertTriangle,
  CheckCircle,
  Search,
  Lock,
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
  const [runTests, setRunTests] = useState<boolean>(true);
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
        throw new Error("No JSONL or JSON files found in this dataset");
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-gradient-to-br from-blue-500/30 to-indigo-500/20 rounded-lg border border-blue-400/50 shadow-lg shadow-blue-500/20">
                  <Database className="w-7 h-7 text-blue-300" />
                </div>
                <div>
                  <h1 className="text-5xl font-bold gradient-text-cyber mb-2 animate-pulse-glow" style={{lineHeight: '1.1', paddingBottom: '4px'}}>
                    Data Poisoning Detection
                  </h1>
                  <p className="text-gray-300 text-base font-semibold">Advanced behavioral analysis for Hugging Face models</p>
                </div>
              </div>
              <p className="text-gray-400 text-sm ml-0 max-w-2xl">Detect malicious data injection, backdoors, and behavioral manipulations using file safety checks and black-box behavioral tests.</p>
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
                <Card className="border-2 border-blue-500/60 shadow-2xl shadow-blue-500/30 h-full bg-gradient-to-br from-slate-900 to-slate-800">
                  <CardHeader className="pb-6 border-b border-blue-500/40 bg-gradient-to-r from-blue-950/50 to-transparent">
                    <CardTitle className="text-white text-3xl font-bold flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-blue-500/40 to-indigo-500/30 rounded-lg">
                        <Search className="w-7 h-7 text-blue-300" />
                      </div>
                      Scan Configuration
                    </CardTitle>
                    <p className="text-gray-300 text-base mt-3 font-medium">Choose how to provide your dataset</p>

                    {/* Tabs */}
                    <div className="flex gap-2 mt-6 border-b border-blue-500/20">
                      <button
                        onClick={() => setInputMode("url")}
                        className={`px-4 py-2 font-semibold transition-all border-b-2 ${
                          inputMode === "url"
                            ? "border-blue-500 text-blue-300"
                            : "border-transparent text-gray-400 hover:text-gray-300"
                        }`}
                      >
                        🔗 HuggingFace URL
                      </button>
                      <button
                        onClick={() => setInputMode("file")}
                        className={`px-4 py-2 font-semibold transition-all border-b-2 ${
                          inputMode === "file"
                            ? "border-blue-500 text-blue-300"
                            : "border-transparent text-gray-400 hover:text-gray-300"
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
                        <Label className="text-gray-200 text-base font-semibold block">🔗 HuggingFace Dataset URL</Label>
                        <div className="relative group">
                          <Input
                            value={modelUrl}
                            onChange={(e) => setModelUrl(e.target.value)}
                            placeholder="https://huggingface.co/datasets/user/dataset"
                            className="w-full bg-white/5 backdrop-blur-md border border-white/10 text-black placeholder-gray-400 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 py-3 px-4 rounded-lg"
                          />
                        </div>
                        <p className="text-gray-400 text-sm flex items-center gap-2">
                          <span>💡</span>
                          Example: https://huggingface.co/datasets/openwebtext/openwebtext
                        </p>
                      </div>
                    )}

                    {/* File Upload Mode */}
                    {inputMode === "file" && (
                      <div className="space-y-4">
                        <Label className="text-gray-200 text-base font-semibold block">📁 Upload Dataset File</Label>
                        <div className="relative group">
                          <div className="border-2 border-dashed border-blue-500/50 rounded-lg p-8 text-center hover:border-blue-400 transition-all cursor-pointer"
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
                                <p className="text-green-400 font-semibold text-lg">✓ File Selected</p>
                                <p className="text-gray-300 text-sm mt-2">{uploadedFile.name}</p>
                                <p className="text-gray-400 text-xs mt-1">({(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB)</p>
                              </>
                            ) : (
                              <>
                                <p className="text-gray-300 font-semibold mb-2">Drag and drop your file here</p>
                                <p className="text-gray-400 text-sm">or click to browse</p>
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
                        <p className="text-gray-400 text-sm flex items-center gap-2">
                          <span>📋</span>
                          Supported formats: JSON, JSONL, CSV, TXT, Parquet
                        </p>
                      </div>
                    )}

                    {/* Behavioral Tests Toggle - only for file upload mode */}
                    {inputMode === "file" && (
                      <div className="space-y-4 border-t border-blue-500/30 pt-8">
                        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-indigo-950/50 to-blue-950/30 rounded-xl border-2 border-indigo-500/50 hover:border-indigo-400 transition-all">
                          <div className="flex-1">
                            <Label className="text-blue-100 text-base font-semibold block mb-2 flex items-center gap-2">
                              <Zap className="w-5 h-5 text-indigo-400" />
                              Advanced Behavioral Tests
                            </Label>
                            <p className="text-gray-300 text-base">Run comprehensive black-box tests to detect backdoors, manipulation triggers, and poisoning patterns</p>
                          </div>
                          <Switch
                            checked={runTests}
                            onCheckedChange={setRunTests}
                            className="accent-blue-500 ml-4 scale-150"
                          />
                        </div>
                        <p className={`text-sm ml-4 font-semibold transition-colors ${runTests ? "text-blue-300" : "text-gray-400"}`}>
                          {runTests ? "✓ Enabled - More thorough analysis (takes longer)" : "○ Disabled - File safety checks only"}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Features & CTA Card */}
              <div className="lg:col-span-1">
                <div className="space-y-6 h-full flex flex-col">
                  <Card className="border-2 border-indigo-500/60 shadow-xl shadow-indigo-500/20 flex-1 bg-gradient-to-br from-slate-900 to-slate-800">
                    <CardHeader className="pb-4 border-b border-indigo-500/40 bg-gradient-to-r from-indigo-950/50 to-transparent">
                      <CardTitle className="text-blue-100 text-lg font-bold flex items-center gap-2">
                        <Shield className="w-5 h-5 text-indigo-400" />
                        What We Check
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      <div className="p-4 bg-gradient-to-br from-blue-950/50 to-blue-900/30 rounded-lg border border-blue-500/40 hover:border-blue-400 transition-all">
                        <p className="text-blue-200 font-semibold mb-2 text-sm flex items-center gap-2">
                          <Activity className="w-4 h-4" /> File Safety
                        </p>
                        <p className="text-gray-300 text-xs">Format, serialization, code</p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-indigo-950/50 to-indigo-900/30 rounded-lg border border-indigo-500/40 hover:border-indigo-400 transition-all">
                        <p className="text-indigo-200 font-semibold mb-2 text-sm flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" /> Behavioral Tests
                        </p>
                        <p className="text-gray-300 text-xs">Safety, triggers, consistency</p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-purple-950/50 to-purple-900/30 rounded-lg border border-purple-500/40 hover:border-purple-400 transition-all">
                        <p className="text-purple-200 font-semibold mb-2 text-sm flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" /> Risk Scoring
                        </p>
                        <p className="text-gray-300 text-xs">System & behavior risks</p>
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
                <Card className="border-2 border-blue-500/60 shadow-2xl shadow-blue-500/30 bg-gradient-to-br from-slate-900 to-slate-800">
                  <CardHeader className="pb-6 border-b border-blue-500/40 bg-gradient-to-r from-blue-950/50 to-transparent">
                    <CardTitle className="text-white text-3xl font-bold flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-blue-500/40 to-indigo-500/30 rounded-lg">
                        <Database className="w-7 h-7 text-blue-300" />
                      </div>
                      Select Dataset File
                    </CardTitle>
                    <p className="text-gray-300 text-base mt-3 font-medium">Choose which file to analyze</p>
                  </CardHeader>
                  <CardContent className="space-y-8 pt-8">
                    <div className="space-y-4">
                      <Label className="text-gray-200 text-base font-semibold block">📂 Available Files</Label>
                      <select
                        value={selectedHFFile}
                        onChange={(e) => setSelectedHFFile(e.target.value)}
                        className="w-full bg-white/5 backdrop-blur-md border border-white/10 text-black focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 py-3 px-4 rounded-lg"
                      >
                        {hfFiles.map(file => (
                          <option key={file.name} value={file.name}>
                            {file.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-gray-400 text-sm">{hfFiles.length} file(s) found in this dataset</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1">
                <div className="space-y-6 h-full flex flex-col">
                  <Card className="border-2 border-indigo-500/60 shadow-xl shadow-indigo-500/20 flex-1 bg-gradient-to-br from-slate-900 to-slate-800">
                    <CardHeader className="pb-4 border-b border-indigo-500/40 bg-gradient-to-r from-indigo-950/50 to-transparent">
                      <CardTitle className="text-blue-100 text-lg font-bold">📋 Next Step</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      <p className="text-gray-300 text-sm">Select a file and click "Load Preview" to see sample data before scanning.</p>
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
                <Card className="border-2 border-blue-500/60 shadow-2xl shadow-blue-500/30 bg-gradient-to-br from-slate-900 to-slate-800">
                  <CardHeader className="pb-6 border-b border-blue-500/40 bg-gradient-to-r from-blue-950/50 to-transparent">
                    <CardTitle className="text-white text-3xl font-bold flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-blue-500/40 to-indigo-500/30 rounded-lg">
                        <Search className="w-7 h-7 text-blue-300" />
                      </div>
                      File Preview
                    </CardTitle>
                    <p className="text-gray-300 text-base mt-3 font-medium">Review sample rows before scanning</p>
                  </CardHeader>
                  <CardContent className="space-y-8 pt-8">
                    <div className="space-y-4">
                      <div className="bg-blue-950/30 rounded-lg p-6 border border-blue-500/40">
                        <h3 className="text-blue-200 text-base font-semibold mb-4">📋 {filePreviewData.filename} - {filePreviewData.preview_count} of {filePreviewData.total_rows} rows</h3>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {filePreviewData.preview_rows.map((row: any, idx: number) => (
                            <div key={idx} className="bg-slate-800/50 p-3 rounded border border-slate-600/30">
                              <p className="text-gray-300 text-sm font-mono whitespace-pre-wrap break-words">
                                {typeof row === 'string' ? row : JSON.stringify(row, null, 2).substring(0, 300)}
                              </p>
                            </div>
                          ))}
                        </div>
                        <p className="text-gray-400 text-xs mt-3">Total rows in file: {filePreviewData.total_rows}</p>
                      </div>

                      {/* Behavioral Tests Toggle */}
                      <div className="space-y-4 border-t border-blue-500/30 pt-8">
                        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-indigo-950/50 to-blue-950/30 rounded-xl border-2 border-indigo-500/50 hover:border-indigo-400 transition-all">
                          <div className="flex-1">
                            <Label className="text-blue-100 text-base font-semibold block mb-2 flex items-center gap-2">
                              <Zap className="w-5 h-5 text-indigo-400" />
                              Run BERT Model Scan
                            </Label>
                            <p className="text-gray-300 text-base">Scan with trained BERT model for poisoning detection</p>
                          </div>
                          <Switch
                            checked={runTests}
                            onCheckedChange={setRunTests}
                            className="accent-blue-500 ml-4 scale-150"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1">
                <div className="space-y-6 h-full flex flex-col">
                  <Card className="border-2 border-indigo-500/60 shadow-xl shadow-indigo-500/20 flex-1 bg-gradient-to-br from-slate-900 to-slate-800">
                    <CardHeader className="pb-4 border-b border-indigo-500/40 bg-gradient-to-r from-indigo-950/50 to-transparent">
                      <CardTitle className="text-blue-100 text-lg font-bold flex items-center gap-2">
                        <Shield className="w-5 h-5 text-indigo-400" />
                        BERT Model Scan
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      <div className="p-4 bg-gradient-to-br from-blue-950/50 to-blue-900/30 rounded-lg border border-blue-500/40">
                        <p className="text-blue-200 font-semibold mb-2 text-sm flex items-center gap-2">
                          🤖 BERT Poisoning Detection
                        </p>
                        <p className="text-gray-300 text-xs">Analyze dataset with trained model</p>
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
                <Card className="border-2 border-blue-500/60 shadow-2xl shadow-blue-500/30 bg-gradient-to-br from-slate-900 to-slate-800">
                  <CardHeader className="pb-6 border-b border-blue-500/40 bg-gradient-to-r from-blue-950/50 to-transparent">
                    <CardTitle className="text-white text-3xl font-bold flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-blue-500/40 to-indigo-500/30 rounded-lg">
                        <Search className="w-7 h-7 text-blue-300" />
                      </div>
                      Data Preview
                    </CardTitle>
                    <p className="text-gray-300 text-base mt-3 font-medium">Review sample rows before scanning</p>
                  </CardHeader>
                  <CardContent className="space-y-8 pt-8">
                    {previewData && (
                      <div className="space-y-4">
                        <div className="bg-blue-950/30 rounded-lg p-6 border border-blue-500/40">
                          <h3 className="text-blue-200 text-base font-semibold mb-4">📋 {previewData.jsonl_file} - {previewData.preview_count} of {previewData.total_rows} rows</h3>
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {previewData.preview_rows.map((row, idx) => (
                              <div key={idx} className="bg-slate-800/50 p-3 rounded border border-slate-600/30">
                                <p className="text-gray-300 text-sm font-mono whitespace-pre-wrap break-words">
                                  {typeof row === 'string' ? row : JSON.stringify(row, null, 2).substring(0, 300)}
                                </p>
                              </div>
                            ))}
                          </div>
                          <p className="text-gray-400 text-xs mt-3">Total rows in file: {previewData.total_rows}</p>
                        </div>

                        {/* Behavioral Tests Toggle */}
                        <div className="space-y-4 border-t border-blue-500/30 pt-8">
                          <div className="flex items-center justify-between p-6 bg-gradient-to-r from-indigo-950/50 to-blue-950/30 rounded-xl border-2 border-indigo-500/50 hover:border-indigo-400 transition-all">
                            <div className="flex-1">
                              <Label className="text-blue-100 text-base font-semibold block mb-2 flex items-center gap-2">
                                <Zap className="w-5 h-5 text-indigo-400" />
                                Run Behavioral Tests
                              </Label>
                              <p className="text-gray-300 text-base">Advanced testing with trained BERT model</p>
                            </div>
                            <Switch
                              checked={runTests}
                              onCheckedChange={setRunTests}
                              className="accent-blue-500 ml-4 scale-150"
                            />
                          </div>
                          <p className={`text-sm ml-4 font-semibold transition-colors ${runTests ? "text-blue-300" : "text-gray-400"}`}>
                            {runTests ? "✓ Enabled - Full BERT analysis" : "○ Disabled - Quick scan"}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1">
                <div className="space-y-6 h-full flex flex-col">
                  <Card className="border-2 border-indigo-500/60 shadow-xl shadow-indigo-500/20 flex-1 bg-gradient-to-br from-slate-900 to-slate-800">
                    <CardHeader className="pb-4 border-b border-indigo-500/40 bg-gradient-to-r from-indigo-950/50 to-transparent">
                      <CardTitle className="text-blue-100 text-lg font-bold flex items-center gap-2">
                        <Shield className="w-5 h-5 text-indigo-400" />
                        BERT Model Scan
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      <div className="p-4 bg-gradient-to-br from-blue-950/50 to-blue-900/30 rounded-lg border border-blue-500/40">
                        <p className="text-blue-200 font-semibold mb-2 text-sm flex items-center gap-2">
                          🤖 BERT Poisoning Detection
                        </p>
                        <p className="text-gray-300 text-xs">Analyze dataset for data poisoning</p>
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
            <Card className="border-2 border-blue-500/60 shadow-2xl shadow-blue-500/40 bg-gradient-to-br from-slate-900 to-slate-800">
              <CardHeader className="pb-8 border-b border-blue-500/40 bg-gradient-to-r from-blue-950/50 to-transparent">
                <CardTitle className="text-white text-3xl font-bold flex items-center gap-3 mb-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500/40 to-indigo-500/30 rounded-lg">
                    <Loader className="w-6 h-6 text-blue-300 animate-spin" />
                  </div>
                  Fetching Dataset Files
                </CardTitle>
                <p className="text-blue-100 text-lg mt-2 font-semibold">Scanning HuggingFace dataset for available files...</p>
              </CardHeader>
              <CardContent className="space-y-8 pt-8">
                <div className="flex justify-center py-12">
                  <div className="relative w-32 h-32 flex items-center justify-center">
                    <div className="absolute w-32 h-32 border-4 border-blue-500/30 rounded-full animate-spin" style={{animationDuration: "3s"}}></div>
                    <div className="absolute w-24 h-24 border-4 border-indigo-500/50 rounded-full animate-spin" style={{animationDuration: "2s", animationDirection: "reverse"}}></div>
                    <Database className="w-8 h-8 text-blue-300" />
                  </div>
                </div>
                <p className="text-center text-gray-300 text-lg">Listing JSONL and JSON files...</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Scanning Phase */}
        {scanPhase === "scanning" && (
          <div className="animate-fadeIn">
            <Card className="border-2 border-blue-500/60 shadow-2xl shadow-blue-500/40 bg-gradient-to-br from-slate-900 to-slate-800">
              <CardHeader className="pb-8 border-b border-blue-500/40 bg-gradient-to-r from-blue-950/50 to-transparent">
                <CardTitle className="text-white text-3xl font-bold flex items-center gap-3 mb-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500/40 to-indigo-500/30 rounded-lg">
                    <Loader className="w-6 h-6 text-blue-300 animate-spin" />
                  </div>
                  Analyzing Dataset with BERT Model
                </CardTitle>
                <p className="text-blue-100 text-lg mt-2 font-semibold">Running poisoning detection with trained BERT model...</p>
              </CardHeader>
              <CardContent className="space-y-8 pt-8">
                {/* Progress Circle */}
                <div className="flex justify-center py-12">
                  <div className="relative w-56 h-56 flex items-center justify-center">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#1e3a8a" strokeWidth="3" />
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
                      <div className="text-7xl font-black text-transparent bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text">
                        {scanProgress}%
                      </div>
                      <div className="text-sm text-blue-300 mt-2 font-semibold">analyzing model</div>
                    </div>
                  </div>
                </div>

                {/* Status Messages */}
                <div className="space-y-4 py-8">
                  <div className={`p-4 rounded-lg border flex items-start gap-3 transition-all ${scanProgress >= 30 ? "bg-blue-500/15 border-blue-500/40" : "bg-slate-500/10 border-slate-500/30"}`}>
                    <div className="text-lg">{scanProgress >= 30 ? "✓" : "○"}</div>
                    <div className="flex-1">
                      <p className={`font-medium ${scanProgress >= 30 ? "text-blue-300" : "text-gray-300"}`}>File Safety Analysis</p>
                      <p className="text-gray-400 text-sm">{scanProgress >= 30 ? "✓ Checking formats, serialization, code patterns" : "Pending..."}</p>
                    </div>
                  </div>
                  {runTests && (
                    <div className={`p-4 rounded-lg border flex items-start gap-3 transition-all ${scanProgress >= 60 ? "bg-blue-500/15 border-blue-500/40" : "bg-slate-500/10 border-slate-500/30"}`}>
                      <div className="text-lg">{scanProgress >= 60 ? "✓" : "○"}</div>
                      <div className="flex-1">
                        <p className={`font-medium ${scanProgress >= 60 ? "text-blue-300" : "text-gray-300"}`}>Behavioral Tests</p>
                        <p className="text-gray-400 text-sm">{scanProgress >= 60 ? "✓ Testing safety, triggers, consistency" : "Pending..."}</p>
                      </div>
                    </div>
                  )}
                  <div className={`p-4 rounded-lg border flex items-start gap-3 transition-all ${scanProgress >= 85 ? "bg-blue-500/15 border-blue-500/40" : "bg-slate-500/10 border-slate-500/30"}`}>
                    <div className="text-lg">{scanProgress >= 85 ? "✓" : "○"}</div>
                    <div className="flex-1">
                      <p className={`font-medium ${scanProgress >= 85 ? "text-blue-300" : "text-gray-300"}`}>Risk Assessment</p>
                      <p className="text-gray-400 text-sm">{scanProgress >= 85 ? "✓ Computing risk scores and recommendation" : "Pending..."}</p>
                    </div>
                  </div>
                </div>

                <p className="text-center text-gray-400 text-sm italic">
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
                className="border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/20 bg-cyan-500/10 backdrop-blur-md hover-lift transition-all"
              >
                <Zap className="w-4 h-4 mr-2" />
                New Scan
              </Button>
              <Button
                onClick={() => downloadReport("json")}
                className="border-blue-500/50 text-blue-300 hover:bg-blue-500/20 bg-blue-500/10 backdrop-blur-md hover-lift transition-all"
              >
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
            </div>

            {/* Scan Results Card */}
            <Card className="glass-card border-cyan-500/40 shadow-lg shadow-cyan-500/20 overflow-hidden bg-gradient-to-br from-slate-900/80 to-slate-800/50">
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
                        <span className="text-gray-300">Poisoning Risk:</span>
                        <div className="w-48 h-2 bg-gray-700/50 rounded-full overflow-hidden">
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
                        <span className="font-bold text-white min-w-12">{Math.round(scanResult.poisoned_percentage || 0)}%</span>
                      </div>
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-white mb-2">🤖 BERT Analysis Results</h2>
                      <p className="text-gray-300 text-lg leading-relaxed max-w-2xl">Scanned {scanResult.total_rows || 0} rows with trained BERT model for data poisoning detection</p>
                    </div>
                  </div>
                </div>
              </div>

              <CardContent className="space-y-8 pt-8">
                {/* Scan Statistics */}
                <div className="space-y-6 border-t border-cyan-500/20 pt-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-gradient-to-br from-blue-500/30 to-cyan-500/20 rounded-lg">
                      <Activity className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">Detection Results</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Total Rows */}
                    <div className="bg-gradient-to-br from-blue-500/15 to-blue-600/5 rounded-xl p-5 border border-blue-500/30 hover:border-blue-500/50 transition-all backdrop-blur-md group cursor-default shadow-lg shadow-blue-500/10">
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-gray-200 text-sm font-bold">Total Rows</label>
                        <div className="text-2xl font-bold text-blue-400 group-hover:scale-110 transition-transform">{scanResult.total_rows || 0}</div>
                      </div>
                      <p className="text-gray-300 text-xs mt-3 font-medium">Rows analyzed</p>
                    </div>

                    {/* Safe Rows */}
                    <div className="bg-gradient-to-br from-green-500/15 to-emerald-600/5 rounded-xl p-5 border border-green-500/30 hover:border-green-500/50 transition-all backdrop-blur-md group cursor-default shadow-lg shadow-green-500/10">
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-gray-200 text-sm font-bold">Safe Rows</label>
                        <div className="text-2xl font-bold text-green-400 group-hover:scale-110 transition-transform">{scanResult.safe_count || 0}</div>
                      </div>
                      <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden border border-green-500/20">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${(scanResult.safe_percentage || 0)}%` }}
                        />
                      </div>
                      <p className="text-gray-300 text-xs mt-3 font-medium">{Math.round(scanResult.safe_percentage || 0)}% safe</p>
                    </div>

                    {/* Poisoned Rows */}
                    <div className="bg-gradient-to-br from-red-500/15 to-orange-600/5 rounded-xl p-5 border border-red-500/30 hover:border-red-500/50 transition-all backdrop-blur-md group cursor-default shadow-lg shadow-red-500/10">
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-gray-200 text-sm font-bold">Poisoned Rows</label>
                        <div className="text-2xl font-bold text-red-400 group-hover:scale-110 transition-transform">{scanResult.poisoned_count || 0}</div>
                      </div>
                      <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden border border-red-500/20">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 via-orange-500 to-red-600 rounded-full transition-all duration-500"
                          style={{ width: `${(scanResult.poisoned_percentage || 0)}%` }}
                        />
                      </div>
                      <p className="text-gray-300 text-xs mt-3 font-medium">{Math.round(scanResult.poisoned_percentage || 0)}% poisoned</p>
                    </div>
                  </div>
                </div>

                {/* Sample Poisoned Rows */}
                {scanResult.sample_rows && scanResult.sample_rows.length > 0 && (
                  <div className="space-y-6 border-t border-cyan-500/20 pt-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-gradient-to-br from-red-500/30 to-orange-500/20 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                      </div>
                      <h3 className="text-2xl font-bold text-white">Sample Poisoned Rows</h3>
                    </div>

                    <div className="space-y-3">
                      {scanResult.sample_rows.slice(0, 5).map((row, idx) => (
                        <div key={idx} className="flex items-start gap-4 p-4 bg-gradient-to-r from-red-900/20 to-slate-700/30 rounded-lg border border-red-500/40 hover:border-red-500/60 transition-all hover:bg-red-900/30">
                          <div className="text-2xl mt-0.5 flex-shrink-0">⚠️</div>
                          <div className="flex-1 break-words">
                            <p className="text-red-200 text-sm leading-relaxed font-mono whitespace-pre-wrap">
                              {typeof row === 'string' ? row : JSON.stringify(row, null, 2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {scanResult.sample_rows.length > 5 && (
                      <p className="text-gray-400 text-sm text-center">... and {scanResult.sample_rows.length - 5} more poisoned rows</p>
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
