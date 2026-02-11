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
  CheckCircle2,
  Search,
  Lock,
  Loader,
  Shield,
  TrendingUp,
  Hexagon,
} from "lucide-react";

type ScanPhase = "setup" | "scanning" | "results";

interface ScanResult {
  scan_id: string;
  model_url: string;
  model_id: string;
  verdict: "safe" | "suspicious" | "unsafe" | "unknown";
  confidence: number;
  explanation: string;
  risk_assessment?: {
    system_compromise_risk: number;
    behavior_manipulation_risk: number;
    combined_risk_score: number;
    recommendation: string;
  };
  file_safety?: {
    has_safe_format: boolean;
    has_unsafe_serialization: boolean;
    has_suspicious_code: boolean;
    risk_score: number;
    details: string[];
  };
  behavioral_tests: any[];
  summary_metrics: any;
}

export function DataPoisoningPage() {
  const [scanPhase, setScanPhase] = useState<ScanPhase>("setup");
  const [modelUrl, setModelUrl] = useState<string>("");
  const [runTests, setRunTests] = useState<boolean>(true);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const startScan = async () => {
    try {
      setError(null);

      if (!modelUrl.trim()) {
        setError("Please enter a Hugging Face model URL");
        return;
      }

      if (!modelUrl.includes("huggingface.co")) {
        setError("Please enter a valid Hugging Face model URL");
        return;
      }

      setScanPhase("scanning");
      setIsLoading(true);
      setScanProgress(0);

      const progressInterval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 12;
        });
      }, 250);

      const token = localStorage.getItem("access_token") || localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication required");
      }

      const response = await fetch(
        `${process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1"}/data-poisoning/scan/quick`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            model_url: modelUrl,
            run_behavioral_tests: runTests,
            max_download_size_gb: 5.0,
            timeout_seconds: 300,
          }),
        }
      );

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Scan failed");
      }

      const result = await response.json();
      setScanProgress(100);

      setTimeout(() => {
        setScanResult(result);
        setScanPhase("results");
        setIsLoading(false);
      }, 500);

    } catch (err: any) {
      setError(err.message || "An error occurred");
      setScanPhase("setup");
      setIsLoading(false);
    }
  };

  const resetScan = () => {
    setScanPhase("setup");
    setScanProgress(0);
    setScanResult(null);
    setError(null);
    setModelUrl("");
  };

  const getVerdictStyles = (verdict: string) => {
    switch (verdict) {
      case "safe":
        return { bg: "from-green-500 to-emerald-600", text: "green", label: "Safe" };
      case "suspicious":
        return { bg: "from-yellow-500 to-orange-600", text: "yellow", label: "Suspicious" };
      case "unsafe":
        return { bg: "from-red-500 to-red-700", text: "red", label: "Unsafe" };
      default:
        return { bg: "from-gray-500 to-slate-600", text: "gray", label: "Unknown" };
    }
  };

  const downloadReport = (format: string) => {
    if (!scanResult) return;
    try {
      const content = JSON.stringify(scanResult, null, 2);
      const filename = `data-poisoning-report-${scanResult.scan_id.slice(0, 8)}.json`;
      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(`Failed to download: ${err.message}`);
    }
  };

  const verdictStyle = scanResult ? getVerdictStyles(scanResult.verdict) : null;

  return (
    <div className="min-h-screen" style={{backgroundColor: '#1d2736'}}>
      {/* Animated Background */}
      <div className="fixed inset-0 opacity-30 pointer-events-none overflow-hidden">
        <div className="absolute top-10 left-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-screen filter blur-3xl opacity-20"></div>
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-blue-500 rounded-full mix-blend-screen filter blur-3xl opacity-20"></div>
      </div>

      <div className="relative z-10 min-h-screen p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          {scanPhase === "setup" && (
            <div className="text-center mb-12 animate-fadeIn">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-xl">
                  <Hexagon className="w-12 h-12 text-white" />
                </div>
              </div>
              <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent mb-4">
                Model Poisoning Detector
              </h1>
              <p className="text-xl text-gray-300 mb-2">
                Scan Hugging Face models for hidden threats and suspicious behavior
              </p>
              <p className="text-gray-400">Advanced behavioral analysis meets file-level security checks</p>
            </div>
          )}

          {/* Setup Phase */}
          {scanPhase === "setup" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              {/* Main Input Section */}
              <div className="lg:col-span-2 space-y-6">
                {/* URL Input Card */}
                <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 hover:border-white/30 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                      <Database className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">Model URL</h2>
                      <p className="text-gray-400 text-sm">Enter the Hugging Face model link</p>
                    </div>
                  </div>

                  <Input
                    value={modelUrl}
                    onChange={(e) => setModelUrl(e.target.value)}
                    placeholder="https://huggingface.co/meta-llama/Llama-2-7b"
                    className="bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 h-12 rounded-xl mb-4"
                  />
                  <p className="text-sm text-gray-400">
                    Examples: meta-llama/Llama-2-7b, gpt2, bert-base-uncased
                  </p>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="backdrop-blur-xl bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                )}

                {/* Test Options */}
                <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Behavioral Tests</h3>
                      <p className="text-sm text-gray-400">Run comprehensive black-box analysis</p>
                    </div>
                    <Switch
                      checked={runTests}
                      onCheckedChange={setRunTests}
                      className="accent-purple-500"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    {runTests ? "Full analysis mode - includes behavioral testing (slower)" : "Quick mode - file safety checks only (faster)"}
                  </p>
                </div>
              </div>

              {/* Info Panel */}
              <div className="space-y-6">
                {/* What Gets Checked */}
                <div className="backdrop-blur-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/20 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-400" />
                    What We Check
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-semibold text-white">File Safety</p>
                        <p className="text-gray-400 text-xs">Format & serialization</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-semibold text-white">Behavior Analysis</p>
                        <p className="text-gray-400 text-xs">Triggers & consistency</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-semibold text-white">Risk Assessment</p>
                        <p className="text-gray-400 text-xs">Comprehensive scoring</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scan Button */}
                <button
                  onClick={startScan}
                  disabled={!modelUrl.trim() || isLoading}
                  className="w-full py-4 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 hover:shadow-xl shadow-lg flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Start Scan
                    </>
                  )}
                </button>

                {/* Info */}
                <p className="text-xs text-gray-500 text-center">
                  🔒 Detection is probabilistic, not guaranteed
                </p>
              </div>
            </div>
          )}

          {/* Scanning Phase */}
          {scanPhase === "scanning" && (
            <div className="flex flex-col items-center justify-center py-20 animate-fadeIn">
              <div className="relative w-32 h-32 mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full opacity-20 blur-xl animate-pulse"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader className="w-16 h-16 text-purple-400 animate-spin" />
                </div>
              </div>

              <h2 className="text-4xl font-bold text-white mb-2">Analyzing Model</h2>
              <p className="text-gray-400 mb-12">Running safety checks and behavioral tests...</p>

              <div className="w-full max-w-md">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-2xl font-bold text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text">{scanProgress}%</span>
                  <span className="text-sm text-gray-400">Complete</span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden border border-white/20">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Results Phase */}
          {scanPhase === "results" && scanResult && (
            <div className="animate-fadeIn">
              {/* Results Header */}
              <div className="mb-8 text-center">
                <Button
                  onClick={resetScan}
                  variant="outline"
                  className="border-gray-500/30 text-gray-300 hover:bg-white/10 bg-transparent mb-6"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  New Scan
                </Button>
              </div>

              {/* Main Verdict Card */}
              <div className={`backdrop-blur-xl bg-gradient-to-br ${verdictStyle?.bg} bg-opacity-10 border border-white/20 rounded-3xl p-8 mb-8 shadow-2xl`}>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-4">
                      <Badge className={`bg-gradient-to-r ${verdictStyle?.bg} text-white px-4 py-2 text-lg`}>
                        {verdictStyle?.label}
                      </Badge>
                      <span className="text-gray-300">
                        <span className="text-3xl font-bold text-white">{Math.round(scanResult.confidence * 100)}%</span>
                        <span className="text-gray-400 ml-2">Confidence</span>
                      </span>
                    </div>
                    <h2 className="text-4xl font-bold text-white mb-3">{scanResult.model_id}</h2>
                    <p className="text-gray-300 text-lg leading-relaxed">{scanResult.explanation}</p>
                  </div>

                  <div className="mt-6 md:mt-0 md:ml-8 flex-shrink-0">
                    <Button
                      onClick={() => downloadReport("json")}
                      className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl px-6 py-3 font-semibold flex items-center gap-2"
                    >
                      <Download className="w-5 h-5" />
                      Export Report
                    </Button>
                  </div>
                </div>
              </div>

              {/* Risk Breakdown */}
              {scanResult.risk_assessment && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  {/* System Compromise */}
                  <div className="backdrop-blur-xl bg-white/5 border border-white/20 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-white">System Risk</h3>
                      <TrendingUp className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="mb-3">
                      <div className="text-3xl font-bold text-red-400">
                        {Math.round(scanResult.risk_assessment.system_compromise_risk * 100)}%
                      </div>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 to-orange-500"
                        style={{ width: `${scanResult.risk_assessment.system_compromise_risk * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Behavior Manipulation */}
                  <div className="backdrop-blur-xl bg-white/5 border border-white/20 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-white">Behavior Risk</h3>
                      <TrendingUp className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div className="mb-3">
                      <div className="text-3xl font-bold text-yellow-400">
                        {Math.round(scanResult.risk_assessment.behavior_manipulation_risk * 100)}%
                      </div>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-yellow-500 to-orange-500"
                        style={{ width: `${scanResult.risk_assessment.behavior_manipulation_risk * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Combined Risk */}
                  <div className="backdrop-blur-xl bg-white/5 border border-white/20 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-white">Overall Risk</h3>
                      <Shield className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="mb-3">
                      <div className="text-3xl font-bold text-purple-400">
                        {Math.round(scanResult.risk_assessment.combined_risk_score * 100)}%
                      </div>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                        style={{ width: `${scanResult.risk_assessment.combined_risk_score * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Recommendation */}
              {scanResult.risk_assessment && (
                <div className="backdrop-blur-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-2xl p-6 mb-8">
                  <p className="font-semibold text-yellow-300 mb-2">📋 Recommendation</p>
                  <p className="text-gray-200">{scanResult.risk_assessment.recommendation}</p>
                </div>
              )}

              {/* File Safety & Tests */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {scanResult.file_safety && (
                  <div className="backdrop-blur-xl bg-white/5 border border-white/20 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-white mb-4">File Safety</h3>
                    <div className="space-y-3">
                      {scanResult.file_safety.details.map((detail, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <span className="text-lg">{detail.includes("✓") ? "✓" : "⚠️"}</span>
                          <p className="text-gray-300 text-sm">{detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {scanResult.behavioral_tests.length > 0 && (
                  <div className="backdrop-blur-xl bg-white/5 border border-white/20 rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-white mb-4">Behavioral Tests</h3>
                    <div className="space-y-3">
                      {scanResult.behavioral_tests.map((test, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                          <div className="flex-1">
                            <p className="font-semibold text-white text-sm">{test.test_name}</p>
                            <p className="text-gray-400 text-xs">{test.details.substring(0, 60)}...</p>
                          </div>
                          <Badge className={test.passed ? "bg-green-600" : "bg-red-600"}>
                            {test.passed ? "✓" : "✗"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DataPoisoningPage;
