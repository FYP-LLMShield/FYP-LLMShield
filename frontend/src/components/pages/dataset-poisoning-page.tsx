import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Textarea } from "../ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Database,
  Upload,
  Zap,
  Download,
  AlertTriangle,
  CheckCircle,
  Search,
  Lock,
  Loader,
  Shield,
  BarChart3,
  TrendingUp,
  FileUp,
  Link,
  Copy,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, ResponsiveContainer } from "recharts";

type AnalysisPhase = "setup" | "analyzing" | "results";
type InputTab = "text" | "file" | "huggingface";

interface DetectionResult {
  technique: string;
  passed: boolean;
  confidence: number;
  findings: string[];
  risk_score: number;
  metrics: Record<string, any>;
}

interface SuspiciousSample {
  sample_index: number;
  suspicious_features: string[];
  anomaly_score: number;
  reason: string;
}

interface DatasetAnalysisResult {
  analysis_id: string;
  dataset_name: string;
  verdict: "safe" | "suspicious" | "unsafe" | "unknown";
  confidence: number;
  explanation: string;
  detection_results: DetectionResult[];
  suspicious_samples: SuspiciousSample[];
  total_samples: number;
  total_features: number;
  suspicious_sample_count: number;
  overall_risk_score: number;
  recommendation: string;
  summary_metrics: Record<string, any>;
}

interface LLMShieldSampleRow {
  index: number;
  text: string;
  security_status: string;
  is_poisoned: boolean;
}

interface LLMShieldResult {
  success: boolean;
  total_rows: number;
  safe_count: number;
  poisoned_count: number;
  safe_percentage: number;
  poisoned_percentage: number;
  sample_rows: LLMShieldSampleRow[];
}

interface LLMShieldTextResult {
  success: boolean;
  text: string;
  security_status: string;
  is_poisoned: boolean;
  confidence: number;
  poison_probability: number;
  safe_probability: number;
}

type AnalysisResult = DatasetAnalysisResult | LLMShieldResult | LLMShieldTextResult;

export function DatasetPoisoningPage() {
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>("setup");
  const [inputTab, setInputTab] = useState<InputTab>("text");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Input states
  const [datasetName, setDatasetName] = useState<string>("dataset");
  const [textContent, setTextContent] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [hfDatasetId, setHfDatasetId] = useState<string>("");
  const [hfConfig, setHfConfig] = useState<string>("");

  // HuggingFace states
  const [hfPreview, setHfPreview] = useState<any>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [hfFileList, setHfFileList] = useState<any>(null);
  const [selectedJsonlFile, setSelectedJsonlFile] = useState<string>("");
  const [hfStage, setHfStage] = useState<'input' | 'fileSelection' | 'preview'>('input');

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const loadJsonlPreview = async (filename: string) => {
    try {
      setError(null);
      setIsPreviewLoading(true);

      const response = await fetch(
        `${process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1"}/dataset-poisoning/preview/huggingface`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dataset_name: datasetName,
            huggingface_dataset_id: hfDatasetId,
            text_content: filename,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Preview failed");
      }

      const preview = await response.json();
      setHfPreview(preview);
      setShowPreview(true);
      setSelectedJsonlFile(filename);
      setHfFileList(null);
      setHfStage('preview');
      setIsPreviewLoading(false);
    } catch (err: any) {
      setError(err.message || "Preview failed");
      setIsPreviewLoading(false);
    }
  };

  const startAnalysis = async () => {
    try {
      setError(null);

      // Validate input
      if (inputTab === "text" && !textContent.trim()) {
        setError("Please paste dataset content");
        return;
      }
      if (inputTab === "file" && !selectedFile) {
        setError("Please select a file");
        return;
      }
      if (inputTab === "huggingface" && !hfDatasetId.trim()) {
        setError("Please enter HuggingFace dataset ID");
        return;
      }

      let progressInterval: ReturnType<typeof setInterval> | undefined;

      const token = localStorage.getItem("access_token") || localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication required. Please login first.");
      }

      let apiEndpoint = "";
      let requestBody: any = {
        dataset_name: datasetName,
      };

      // Prepare request based on input method
      if (inputTab === "text") {
        setAnalysisPhase("analyzing");
        setIsLoading(true);
        setAnalysisProgress(0);

        // Simulate progress
        progressInterval = setInterval(() => {
          setAnalysisProgress((prev) => {
            if (prev >= 90) {
              clearInterval(progressInterval!);
              return 90;
            }
            return prev + Math.random() * 20;
          });
        }, 500);
        // Use LLM Shield endpoint for single text
        apiEndpoint = "/dataset-poisoning/scan/text";
        requestBody.text_content = textContent;

        const response = await fetch(
          `${process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1"}${apiEndpoint}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(requestBody),
          }
        );

        if (progressInterval) clearInterval(progressInterval);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Analysis failed");
        }

        const result = await response.json();
        setAnalysisProgress(100);

        setTimeout(() => {
          setAnalysisResult(result);
          setAnalysisPhase("results");
          setIsLoading(false);
        }, 500);
        return;
      } else if (inputTab === "file") {
        // Use LLM Shield endpoint for file upload
        setAnalysisPhase("analyzing");
        setIsLoading(true);
        setAnalysisProgress(0);

        // Simulate progress
        progressInterval = setInterval(() => {
          setAnalysisProgress((prev) => {
            if (prev >= 90) {
              clearInterval(progressInterval!);
              return 90;
            }
            return prev + Math.random() * 20;
          });
        }, 500);

        apiEndpoint = "/dataset-poisoning/scan/upload";
        const formData = new FormData();
        formData.append("file", selectedFile!);

        const response = await fetch(
          `${process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1"}${apiEndpoint}`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (progressInterval) clearInterval(progressInterval);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Analysis failed");
        }

        const result = await response.json();
        setAnalysisProgress(100);

        setTimeout(() => {
          setAnalysisResult(result);
          setAnalysisPhase("results");
          setIsLoading(false);
        }, 500);
        return;
      } else {
        // HuggingFace flow
        if (progressInterval) clearInterval(progressInterval);
        setIsLoading(false);

        // Stage 1: Input - List files in dataset
        if (hfStage === 'input') {
          try {
            const listResponse = await fetch(
              `${process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1"}/dataset-poisoning/list/huggingface`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dataset_name: datasetName, huggingface_dataset_id: hfDatasetId }),
              }
            );

            if (!listResponse.ok) {
              const errorData = await listResponse.json();
              throw new Error(errorData.detail || "Failed to list files");
            }

            const fileList = await listResponse.json();
            setHfFileList(fileList);

            if (fileList.file_count === 1) {
              // Single file - go directly to preview
              loadJsonlPreview(fileList.jsonl_files[0]);
            } else {
              // Multiple files - show selection
              setHfStage('fileSelection');
              setSelectedJsonlFile(fileList.jsonl_files[0]);
            }
          } catch (err: any) {
            setError(err.message || "Failed to list files");
          }
          return;
        }

        // Stage 2: Preview - Load preview and show it
        if (hfStage === 'fileSelection' || (hfStage === 'preview' && !showPreview)) {
          if (!selectedJsonlFile) {
            setError("Please select a file");
            return;
          }
          try {
            await loadJsonlPreview(selectedJsonlFile);
          } catch (err: any) {
            setError(err.message || "Failed to load preview");
          }
          return;
        }

        // Stage 3: Scanning - Proceed with scan
        if (hfStage === 'preview' && showPreview) {
          try {
            setAnalysisPhase("analyzing");
            setIsLoading(true);
            setAnalysisProgress(0);

            // Simulate progress
            progressInterval = setInterval(() => {
              setAnalysisProgress((prev) => {
                if (prev >= 90) {
                  clearInterval(progressInterval!);
                  return 90;
                }
                return prev + Math.random() * 20;
              });
            }, 500);

            const scanResponse = await fetch(
              `${process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1"}/dataset-poisoning/scan/huggingface`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  dataset_name: datasetName,
                  huggingface_dataset_id: hfDatasetId,
                  jsonl_file: selectedJsonlFile
                }),
              }
            );

            if (progressInterval) clearInterval(progressInterval);

            if (!scanResponse.ok) {
              const errorData = await scanResponse.json();
              throw new Error(errorData.detail || "Scan failed");
            }

            const result = await scanResponse.json();
            setAnalysisProgress(100);

            setTimeout(() => {
              setAnalysisResult(result);
              setAnalysisPhase("results");
              setIsLoading(false);
            }, 500);
          } catch (err: any) {
            setError(err.message || "Scan failed");
            setAnalysisPhase("setup");
            setIsLoading(false);
          }
        }
        return;
      }

      // This code is for the old generic analyze endpoint (not used anymore)
      // Make API call
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1"}${apiEndpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Analysis failed");
      }

      const result = await response.json();
      setAnalysisProgress(100);

      setTimeout(() => {
        setAnalysisResult(result);
        setAnalysisPhase("results");
        setIsLoading(false);
      }, 500);
    } catch (err: any) {
      setError(err.message || "Analysis failed");
      setAnalysisPhase("setup");
      setIsLoading(false);
    }
  };

  const resetAnalysis = () => {
    setAnalysisPhase("setup");
    setAnalysisProgress(0);
    setAnalysisResult(null);
    setError(null);
    setTextContent("");
    setSelectedFile(null);
    setHfDatasetId("");
    setHfPreview(null);
    setHfFileList(null);
    setShowPreview(false);
    setSelectedJsonlFile("");
    setIsPreviewLoading(false);
    setHfStage('input');
  };

  const downloadReport = (format: string) => {
    if (!analysisResult) return;

    try {
      let content = "";
      let filename = "";

      // Check if it's a DatasetAnalysisResult (has analysis_id) or LLMShieldResult
      if ('analysis_id' in analysisResult) {
        const datasetResult = analysisResult as DatasetAnalysisResult;
        filename = `dataset-analysis-${datasetResult.analysis_id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
      } else {
        filename = `llm-shield-scan-${new Date().toISOString().slice(0, 10)}.json`;
      }

      if (format === "json") {
        content = JSON.stringify(analysisResult, null, 2);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-3">
                <div className="p-3 bg-gradient-to-br from-purple-500/30 to-pink-500/20 rounded-lg border border-purple-400/50 shadow-lg shadow-purple-500/20">
                  <Database className="w-7 h-7 text-purple-300" />
                </div>
                <div>
                  <h1 className="text-5xl font-bold gradient-text-cyber mb-2 animate-pulse-glow" style={{lineHeight: '1.1', paddingBottom: '4px'}}>
                    Data Poisoning Detection
                  </h1>
                </div>
              </div>
              <p className="text-gray-400 text-sm ml-0 max-w-2xl">
                Upload or paste your dataset to detect poisoning indicators.
              </p>
            </div>
            {analysisPhase !== "setup" && (
              <Button
                onClick={resetAnalysis}
                className="ml-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
              >
                <Zap className="mr-2 h-5 w-5" />
                New Analysis
              </Button>
            )}
          </div>
        </div>

        {/* Setup Phase */}
        {analysisPhase === "setup" && (
          <div className="space-y-4">
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

            <div className="space-y-3">
              {/* Input Card */}
              <div>
                <Card className="border-2 border-purple-500/60 shadow-2xl shadow-purple-500/30 h-full bg-gradient-to-br from-slate-900 to-slate-800">
                  <CardHeader className="pb-4 border-b border-purple-500/40 bg-gradient-to-r from-purple-950/50 to-transparent">
                    <CardTitle className="text-white text-2xl font-bold flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-purple-500/40 to-pink-500/30 rounded-lg">
                        <FileUp className="w-6 h-6 text-purple-300" />
                      </div>
                      Dataset Input
                    </CardTitle>
                    <p className="text-gray-300 text-sm mt-2 font-medium">Choose how to provide your dataset</p>
                  </CardHeader>
                  <CardContent className="pt-5">
                    <Tabs value={inputTab} onValueChange={(val) => setInputTab(val as InputTab)} className="w-full">
                      <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 border border-purple-500/30 mb-4">
                        <TabsTrigger value="text" className="flex items-center gap-2 text-sm">
                          <Copy className="w-4 h-4" />
                          <span className="hidden sm:inline">Text Paste</span>
                        </TabsTrigger>
                        <TabsTrigger value="file" className="flex items-center gap-2 text-sm">
                          <Upload className="w-4 h-4" />
                          <span className="hidden sm:inline">File Upload</span>
                        </TabsTrigger>
                        <TabsTrigger value="huggingface" className="flex items-center gap-2 text-sm">
                          <Link className="w-4 h-4" />
                          <span className="hidden sm:inline">HF Dataset</span>
                        </TabsTrigger>
                      </TabsList>

                      {/* Text Paste Tab */}
                      <TabsContent value="text" className="space-y-3 mt-4">
                        <div>
                          <Label className="text-gray-200 text-sm font-semibold block mb-2">
                            Paste Text or Dataset (Single or Multiple Rows)
                          </Label>
                          <Textarea
                            value={textContent}
                            onChange={(e) => setTextContent(e.target.value)}
                            placeholder="Paste a single text or multiple rows (CSV, JSON, JSONL format)..."
                            className="w-full h-64 bg-white !text-black placeholder-gray-400 border-2 border-purple-500/40 focus:border-purple-500/80 focus:ring-2 focus:ring-purple-500/30 transition-all duration-300 p-4 rounded-lg"
                            style={{ color: '#000000' }}
                          />
                          <p className="text-gray-400 text-sm mt-2">
                            💡 Paste a single line/text for individual analysis, or multiple rows (CSV/JSON/JSONL) for batch analysis
                          </p>
                        </div>
                      </TabsContent>

                      {/* File Upload Tab */}
                      <TabsContent value="file" className="space-y-3 mt-4">
                        <div>
                          <Label className="text-gray-200 text-sm font-semibold block mb-2">
                            Upload Dataset File
                          </Label>
                          <div className="border-2 border-dashed border-purple-500/30 rounded-lg p-8 text-center hover:border-purple-500/60 transition-all">
                            <input
                              type="file"
                              onChange={handleFileUpload}
                              accept=".jsonl,.csv"
                              className="hidden"
                              id="file-upload"
                            />
                            <label htmlFor="file-upload" className="cursor-pointer">
                              <Upload className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                              <p className="text-gray-200 font-semibold">
                                {selectedFile ? selectedFile.name : "Click to upload or drag and drop"}
                              </p>
                              <p className="text-gray-400 text-sm mt-1">
                                JSONL or CSV format (max 500MB)
                              </p>
                            </label>
                          </div>
                        </div>
                      </TabsContent>

                      {/* HuggingFace Tab */}
                      <TabsContent value="huggingface" className="space-y-3 mt-4">
                        <div>
                          <Label className="text-gray-200 text-sm font-semibold block mb-2">
                            HuggingFace Dataset ID or URL
                          </Label>
                          <Input
                            value={hfDatasetId}
                            onChange={(e) => setHfDatasetId(e.target.value)}
                            placeholder="e.g., username/dataset-name or full URL"
                            className="w-full bg-white !text-black placeholder-gray-400 border-2 border-purple-500/40 focus:border-purple-500/80 focus:ring-2 focus:ring-purple-500/30 transition-all py-3 px-4 rounded-lg"
                            style={{ color: '#000000' }}
                          />
                          <p className="text-gray-400 text-sm mt-2">
                            💡 Paste dataset ID (e.g., username/dataset) or full URL. Click "Start Analysis" to detect and select files.
                          </p>
                        </div>
                      </TabsContent>
                    </Tabs>

                    {/* Dataset Name */}
                    <div className="mt-4">
                      <Label className="text-gray-200 text-sm font-semibold block mb-2">
                        Dataset Name
                      </Label>
                      <Input
                        value={datasetName}
                        onChange={(e) => setDatasetName(e.target.value)}
                        placeholder="my-dataset"
                        className="w-full bg-white !text-black placeholder-gray-400 border-2 border-purple-500/40 focus:border-purple-500/80 focus:ring-2 focus:ring-purple-500/30 transition-all py-3 px-4 rounded-lg"
                        style={{ color: '#000000' }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* File Selection Section */}
              {hfFileList && hfFileList.file_count > 1 && (
                <div className="space-y-4 animate-fadeIn">
                  <Card className="border-2 border-green-500/60 shadow-2xl shadow-green-500/30 bg-gradient-to-br from-slate-900 to-slate-800">
                    <CardHeader className="pb-4 border-b border-green-500/40 bg-gradient-to-r from-green-950/50 to-transparent">
                      <CardTitle className="text-white text-xl font-bold flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-green-500/40 to-emerald-500/30 rounded-lg">
                          <FileUp className="w-5 h-5 text-green-300" />
                        </div>
                        Select JSONL File - Found {hfFileList.file_count} files
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <Label className="text-gray-300 text-sm font-semibold block mb-3">Available .jsonl Files:</Label>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {hfFileList.jsonl_files.map((file: string, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => loadJsonlPreview(file)}
                            className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                              selectedJsonlFile === file
                                ? "border-green-500/60 bg-green-500/15 text-green-300"
                                : "border-gray-600/40 bg-gray-800/30 text-gray-300 hover:border-green-500/40"
                            }`}
                          >
                            <p className="font-semibold">{file}</p>
                            <p className="text-xs text-gray-400 mt-1">Click to preview this file</p>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Preview Section */}
              {showPreview && hfPreview && (
                <div className="space-y-4 animate-fadeIn">
                  <Card className="border-2 border-blue-500/60 shadow-2xl shadow-blue-500/30 bg-gradient-to-br from-slate-900 to-slate-800">
                    <CardHeader className="pb-4 border-b border-blue-500/40 bg-gradient-to-r from-blue-950/50 to-transparent">
                      <CardTitle className="text-white text-xl font-bold flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-500/40 to-cyan-500/30 rounded-lg">
                          <Database className="w-5 h-5 text-blue-300" />
                        </div>
                        Dataset Preview - {hfPreview.preview_count} Sample Rows (Total: {hfPreview.total_rows} rows)
                      </CardTitle>
                      <p className="text-gray-300 text-sm mt-2">File: <span className="text-blue-300 font-semibold">{hfPreview.jsonl_file}</span></p>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-blue-500/30">
                              <th className="text-left py-3 px-4 text-gray-300 font-semibold">#</th>
                              <th className="text-left py-3 px-4 text-gray-300 font-semibold">Content Preview</th>
                            </tr>
                          </thead>
                          <tbody>
                            {hfPreview.preview_rows.map((row: any, idx: number) => {
                              const rowContent = JSON.stringify(row);
                              const preview = rowContent.length > 200 ? rowContent.substring(0, 200) + "..." : rowContent;
                              return (
                                <tr key={idx} className="border-b border-blue-500/20 hover:bg-blue-500/10">
                                  <td className="py-3 px-4 text-gray-400 font-medium">{idx + 1}</td>
                                  <td className="py-3 px-4 text-gray-300 font-mono text-xs break-all">{preview}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-gray-400 text-sm mt-4 text-center">Ready to scan {hfPreview.total_rows} rows? Click "Start Analysis" to begin.</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Start Analysis Button */}
              <Button
                onClick={startAnalysis}
                disabled={isLoading}
                className="w-full h-14 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 hover:from-purple-700 hover:via-pink-700 hover:to-purple-700 text-white shadow-xl hover:shadow-pink-500/50 transition-all duration-300 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
              >
                <Search className="mr-2 h-5 w-5" />
                {isLoading ? "Analyzing..." : "Start Analysis"}
              </Button>
            </div>
          </div>
        )}

        {/* Analyzing Phase */}
        {analysisPhase === "analyzing" && (
          <div className="animate-fadeIn">
            <Card className="border-2 border-purple-500/60 shadow-2xl shadow-purple-500/40 bg-gradient-to-br from-slate-900 to-slate-800">
              <CardHeader className="pb-8 border-b border-purple-500/40 bg-gradient-to-r from-purple-950/50 to-transparent">
                <CardTitle className="text-white text-3xl font-bold flex items-center gap-3 mb-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500/40 to-pink-500/30 rounded-lg">
                    <Loader className="w-6 h-6 text-purple-300 animate-spin" />
                  </div>
                  Scanning with LLM Shield
                </CardTitle>
                <p className="text-purple-100 text-lg mt-2 font-semibold">Processing dataset for poisoning detection...</p>
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
                        strokeDasharray={`${282.7 * (analysisProgress / 100)} 282.7`}
                        strokeLinecap="round"
                        className="transition-all duration-300"
                        transform="rotate(-90 50 50)"
                      />
                      <defs>
                        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#a855f7" />
                          <stop offset="100%" stopColor="#ec4899" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute text-center">
                      <div className="text-7xl font-black text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text">
                        {Math.round(analysisProgress)}%
                      </div>
                      <div className="text-sm text-purple-300 mt-2 font-semibold">analyzing</div>
                    </div>
                  </div>
                </div>

                {/* Status Messages */}
                <div className="space-y-4 py-8">
                  {[
                    { name: "Loading MultiTaskBERT Model", progress: 20 },
                    { name: "Parsing Dataset File", progress: 40 },
                    { name: "Running Inference", progress: 70 },
                    { name: "Generating Results", progress: 95 },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border flex items-start gap-3 transition-all ${
                        analysisProgress >= item.progress
                          ? "bg-purple-500/15 border-purple-500/40"
                          : "bg-slate-500/10 border-slate-500/30"
                      }`}
                    >
                      <div className="text-lg">{analysisProgress >= item.progress ? "✓" : "○"}</div>
                      <div className="flex-1">
                        <p
                          className={`font-medium ${
                            analysisProgress >= item.progress ? "text-purple-300" : "text-gray-300"
                          }`}
                        >
                          {item.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-center text-gray-400 text-sm italic">
                  Analyzing dataset for poisoning indicators...
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results Phase */}
        {analysisPhase === "results" && analysisResult && (
          <div className="space-y-8 animate-fadeIn">
            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3">
              <Button
                onClick={resetAnalysis}
                className="border-purple-500/50 text-purple-300 hover:bg-purple-500/20 bg-purple-500/10 backdrop-blur-md hover-lift transition-all"
              >
                <Zap className="w-4 h-4 mr-2" />
                New Analysis
              </Button>
              <Button
                onClick={() => downloadReport("json")}
                className="border-purple-500/50 text-purple-300 hover:bg-purple-500/20 bg-purple-500/10 backdrop-blur-md hover-lift transition-all"
              >
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
            </div>

            {/* LLM Shield Single Text Result */}
            {('poison_probability' in analysisResult) && (
              <div className="space-y-6">
                <Card className={`border-2 ${(analysisResult as LLMShieldTextResult).is_poisoned ? 'border-red-500/60' : 'border-green-500/60'} bg-gradient-to-br from-slate-900 to-slate-800`}>
                  <CardHeader className={`pb-6 border-b ${(analysisResult as LLMShieldTextResult).is_poisoned ? 'border-red-500/40 bg-red-950/30' : 'border-green-500/40 bg-green-950/30'}`}>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white text-2xl">Poison Detection Result</CardTitle>
                      <Badge className={`${(analysisResult as LLMShieldTextResult).is_poisoned ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white text-lg px-4 py-2`}>
                        {(analysisResult as LLMShieldTextResult).security_status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    {/* Text Input */}
                    <div>
                      <p className="text-gray-400 text-sm font-medium mb-2">Input Text</p>
                      <p className="text-gray-200 bg-slate-800/50 p-4 rounded-lg border border-purple-500/20 max-h-32 overflow-y-auto">
                        {(analysisResult as LLMShieldTextResult).text}
                      </p>
                    </div>

                    {/* Probability Breakdown */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-green-950/30 border border-green-500/40 rounded-lg">
                        <p className="text-gray-300 text-sm font-medium mb-2">Safe Probability</p>
                        <p className="text-3xl font-bold text-green-400">{(analysisResult as LLMShieldTextResult).safe_probability}%</p>
                      </div>
                      <div className="p-4 bg-red-950/30 border border-red-500/40 rounded-lg">
                        <p className="text-gray-300 text-sm font-medium mb-2">Poison Probability</p>
                        <p className="text-3xl font-bold text-red-400">{(analysisResult as LLMShieldTextResult).poison_probability}%</p>
                      </div>
                    </div>

                    {/* Confidence Bar */}
                    <div>
                      <p className="text-gray-300 text-sm font-medium mb-2">
                        Model Confidence: {(analysisResult as LLMShieldTextResult).confidence}%
                      </p>
                      <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${(analysisResult as LLMShieldTextResult).confidence}%` }}
                          className={`h-full ${(analysisResult as LLMShieldTextResult).is_poisoned ? 'bg-red-500' : 'bg-green-500'}`}
                        ></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* LLM Shield Results (when using file upload) */}
            {('sample_rows' in analysisResult) && (
              <div className="space-y-6">
                {/* Summary Stats Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="border-2 border-blue-500/50 bg-gradient-to-br from-slate-900 to-slate-800">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-gray-400 text-sm font-medium mb-2">Total Rows</p>
                        <p className="text-4xl font-bold text-white">{(analysisResult as LLMShieldResult).total_rows}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-green-500/50 bg-gradient-to-br from-slate-900 to-slate-800">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-gray-400 text-sm font-medium mb-2">Safe Rows</p>
                        <p className="text-4xl font-bold text-green-400">{(analysisResult as LLMShieldResult).safe_count}</p>
                        <p className="text-sm text-green-400/70 mt-1">{(analysisResult as LLMShieldResult).safe_percentage}%</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-red-500/50 bg-gradient-to-br from-slate-900 to-slate-800">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-gray-400 text-sm font-medium mb-2">Poisoned Rows</p>
                        <p className="text-4xl font-bold text-red-400">{(analysisResult as LLMShieldResult).poisoned_count}</p>
                        <p className="text-sm text-red-400/70 mt-1">{(analysisResult as LLMShieldResult).poisoned_percentage}%</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Pie Chart */}
                  <Card className="border-2 border-purple-500/40 bg-gradient-to-br from-slate-900 to-slate-800">
                    <CardHeader>
                      <CardTitle className="text-white">Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Safe", value: (analysisResult as LLMShieldResult).safe_count },
                              { name: "Poisoned", value: (analysisResult as LLMShieldResult).poisoned_count },
                            ]}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            dataKey="value"
                          >
                            <Cell fill="#22c55e" />
                            <Cell fill="#ef4444" />
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #9333ea", color: "#fff" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Bar Chart */}
                  <Card className="border-2 border-purple-500/40 bg-gradient-to-br from-slate-900 to-slate-800">
                    <CardHeader>
                      <CardTitle className="text-white">Count Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={[
                            { name: "Safe", count: (analysisResult as LLMShieldResult).safe_count },
                            { name: "Poisoned", count: (analysisResult as LLMShieldResult).poisoned_count },
                          ]}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="name" stroke="#9ca3af" />
                          <YAxis stroke="#9ca3af" />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #9333ea" }}
                            labelStyle={{ color: "#fff" }}
                          />
                          <Bar dataKey="count" fill="#9333ea" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* Percentage Bar */}
                <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden">
                  <div className="flex h-full">
                    <div style={{ width: `${analysisResult.safe_percentage}%` }} className="bg-green-500"></div>
                    <div style={{ width: `${analysisResult.poisoned_percentage}%` }} className="bg-red-500"></div>
                  </div>
                </div>

                {/* Sample Results Table */}
                <Card className="border-2 border-purple-500/40 bg-gradient-to-br from-slate-900 to-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white">Sample Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-purple-500/30">
                            <th className="text-left py-3 px-4 text-gray-300 font-semibold">#</th>
                            <th className="text-left py-3 px-4 text-gray-300 font-semibold">Text Preview</th>
                            <th className="text-center py-3 px-4 text-gray-300 font-semibold">Security Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(analysisResult as LLMShieldResult).sample_rows.map((row: any) => (
                            <tr
                              key={row.index}
                              className={`border-b border-purple-500/20 ${
                                row.is_poisoned ? "bg-red-950/20" : "bg-green-950/20"
                              }`}
                            >
                              <td className="py-3 px-4 text-gray-400">{row.index}</td>
                              <td className="py-3 px-4 text-gray-300 truncate max-w-xs">{row.text}</td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`text-sm font-medium ${
                                    row.is_poisoned ? "text-red-400" : "text-green-400"
                                  }`}
                                >
                                  {row.security_status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Verdict Card - Only show for DatasetAnalysisResult */}
            {'verdict' in analysisResult && (
            <Card className="glass-card border-purple-500/40 shadow-lg shadow-purple-500/20 overflow-hidden bg-gradient-to-br from-slate-900/80 to-slate-800/50">
              <div
                className={`bg-gradient-to-r ${
                  analysisResult.verdict === "safe"
                    ? "from-emerald-600/25 to-cyan-600/20 border-emerald-500/30"
                    : analysisResult.verdict === "unsafe"
                    ? "from-red-600/25 to-orange-600/20 border-red-500/30"
                    : "from-yellow-600/25 to-amber-600/20 border-yellow-500/30"
                } border-b px-8 py-8`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-4">
                      <Badge
                        className={`${
                          analysisResult.verdict === "safe"
                            ? "bg-green-600 hover:bg-green-700"
                            : analysisResult.verdict === "unsafe"
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-yellow-600 hover:bg-yellow-700"
                        } text-white capitalize flex items-center gap-2 px-4 py-2 text-lg`}
                      >
                        {getVerdictIcon(analysisResult.verdict)}
                        {analysisResult.verdict.toUpperCase()}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300">Confidence:</span>
                        <div className="w-48 h-2 bg-gray-700/50 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              analysisResult.verdict === "safe"
                                ? "bg-green-500"
                                : analysisResult.verdict === "unsafe"
                                ? "bg-red-500"
                                : "bg-yellow-500"
                            }`}
                            style={{ width: `${analysisResult.confidence * 100}%` }}
                          />
                        </div>
                        <span className="font-bold text-white min-w-12">
                          {Math.round(analysisResult.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-white mb-2">{analysisResult.dataset_name}</h2>
                      <p className="text-gray-300 text-lg leading-relaxed max-w-2xl">{analysisResult.explanation}</p>
                    </div>
                  </div>
                </div>
              </div>

              <CardContent className="space-y-8 pt-8">
                {/* Risk Breakdown */}
                <div className="space-y-6 border-t border-purple-500/20 pt-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-gradient-to-br from-red-500/30 to-orange-500/20 rounded-lg">
                      <BarChart3 className="w-5 h-5 text-red-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">Detection Results</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analysisResult.detection_results.map((result, idx) => (
                      <div
                        key={idx}
                        className={`rounded-xl p-5 border backdrop-blur-md transition-all hover:border-opacity-100 shadow-lg ${
                          result.passed
                            ? "bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/40 hover:border-emerald-500/60 shadow-emerald-500/10"
                            : "bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/40 hover:border-red-500/60 shadow-red-500/10"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="text-white font-bold text-lg capitalize">{result.technique.replace(/_/g, " ")}</h4>
                            <p className="text-gray-300 text-sm mt-2">
                              {result.findings.length > 0
                                ? result.findings.slice(0, 1).join(", ")
                                : "No issues found"}
                            </p>
                          </div>
                          <Badge
                            className={`${
                              result.passed ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                            } text-white whitespace-nowrap ml-3 px-3 py-1 font-semibold`}
                          >
                            {result.passed ? "✓ PASS" : "✗ FAIL"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-white/10">
                          <span className="text-gray-300 text-xs font-medium">Risk Score</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-slate-700/50 rounded-full overflow-hidden border border-white/10">
                              <div
                                className={`h-full ${
                                  result.risk_score > 0.5 ? "bg-red-500" : "bg-green-500"
                                }`}
                                style={{ width: `${result.risk_score * 100}%` }}
                              />
                            </div>
                            <span className="text-gray-200 font-semibold text-xs min-w-12">
                              {Math.round(result.risk_score * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Suspicious Samples */}
                {analysisResult.suspicious_samples.length > 0 && (
                  <div className="space-y-6 border-t border-purple-500/20 pt-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-gradient-to-br from-orange-500/30 to-red-500/20 rounded-lg">
                        <AlertCircle className="w-5 h-5 text-orange-400" />
                      </div>
                      <h3 className="text-2xl font-bold text-white">
                        Suspicious Samples ({analysisResult.suspicious_sample_count})
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {analysisResult.suspicious_samples.slice(0, 5).map((sample, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-4 p-4 bg-gradient-to-r from-orange-900/30 to-red-900/20 rounded-lg border border-orange-500/40 hover:border-orange-500/60 transition-all"
                        >
                          <div className="text-2xl mt-0.5 flex-shrink-0">⚠️</div>
                          <div className="flex-1">
                            <p className="text-orange-200 font-semibold">
                              Sample #{sample.sample_index}: {sample.reason}
                            </p>
                            <p className="text-gray-300 text-sm mt-1">
                              Anomaly Score: {Math.round(sample.anomaly_score * 100)}% | Features: {sample.suspicious_features.join(", ")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary Statistics */}
                <div className="space-y-6 border-t border-purple-500/20 pt-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-gradient-to-br from-cyan-500/30 to-blue-500/20 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">Summary</h3>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Total Samples", value: analysisResult.total_samples },
                      { label: "Features/Columns", value: analysisResult.total_features },
                      { label: "Suspicious Samples", value: analysisResult.suspicious_sample_count },
                      { label: "Overall Risk", value: `${Math.round(analysisResult.overall_risk_score * 100)}%` },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-gradient-to-br from-cyan-500/15 to-blue-500/10 rounded-xl border border-cyan-500/40 text-center"
                      >
                        <p className="text-gray-300 text-sm mb-2 font-medium">{item.label}</p>
                        <p className="text-xl font-bold text-cyan-300">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendation */}
                <div className="bg-gradient-to-r from-purple-500/15 via-pink-500/10 to-purple-500/10 border border-purple-500/40 rounded-xl p-6 backdrop-blur-md mt-6 shadow-lg shadow-purple-500/10">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💡</span>
                    <div className="flex-1">
                      <p className="text-purple-300 font-bold mb-2 text-lg">Recommendation</p>
                      <p className="text-gray-200 leading-relaxed font-medium">{analysisResult.recommendation}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default DatasetPoisoningPage;
