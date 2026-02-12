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
} from "lucide-react";

type ScanPhase = "setup" | "scanning" | "results";

export interface Message {
  id: string;
  prompt: string;
  safeResponse: string | null;
  poisonResponse: string | null;
  generationTime: number;
}

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
        setError("Please enter a valid Hugging Face model URL (e.g., https://huggingface.co/user/model)");
        return;
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
      setError(err.message || "An error occurred during scanning");
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
      let filename = `data-poisoning-report-${scanResult.scan_id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}`;

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
    <div className="min-h-screen p-6" style={{backgroundColor: '#0f1419'}}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="animate-fadeIn flex-1">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-lg border border-red-500/30">
                <Database className="w-8 h-8 text-red-400" />
              </div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-red-400 via-orange-400 to-red-400 bg-clip-text text-transparent mb-0" style={{lineHeight: '1.2'}}>
                Model Poisoning Detection
              </h1>
            </div>
            <p className="text-gray-400 text-lg ml-16">Advanced behavioral analysis and file safety checks for Hugging Face models</p>
          </div>
          {scanPhase !== "setup" && (
            <Button
              onClick={resetScan}
              className="border-red-500/30 text-red-400 hover:bg-red-500/20 bg-transparent/50 backdrop-blur-md hover-lift animate-glow ml-8"
            >
              <Zap className="mr-2 h-4 w-4" />
              New Scan
            </Button>
          )}
        </div>

        {/* Setup Phase */}
        {scanPhase === "setup" && (
          <div className="space-y-8">
            {error && (
              <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-5 backdrop-blur-md animate-pulse">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-6 w-6 text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-red-300 font-bold text-base">Error During Scan</span>
                    <p className="text-red-200 mt-2 text-sm">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-fadeIn">
              {/* Main Input Card */}
              <div className="xl:col-span-3">
                <Card className="glass-card border-red-500/30 shadow-red-500/20 h-full hover:border-red-500/50 transition-all duration-300">
                  <CardHeader className="pb-6 border-b border-white/5">
                    <CardTitle className="text-white text-2xl flex items-center gap-3">
                      <div className="p-2 bg-red-500/20 rounded-lg">
                        <Database className="w-6 h-6 text-red-400" />
                      </div>
                      Scan Configuration
                    </CardTitle>
                    <p className="text-gray-400 text-sm mt-2">Enter the Hugging Face model URL to analyze</p>
                  </CardHeader>
                  <CardContent className="space-y-8 pt-8">
                    {/* Model URL Input */}
                    <div className="space-y-4">
                      <Label className="text-gray-300 text-base font-semibold">Hugging Face Model URL</Label>
                      <div className="relative">
                        <Input
                          value={modelUrl}
                          onChange={(e) => setModelUrl(e.target.value)}
                          placeholder="https://huggingface.co/username/model-name"
                          className="bg-gradient-to-r from-white/5 to-white/10 backdrop-blur-md border border-white/10 hover:border-white/20 text-white placeholder-gray-500 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all duration-300 pl-4 py-3"
                        />
                      </div>
                      <p className="text-gray-400 text-sm flex items-center gap-2">
                        <span className="text-blue-400">💡</span>
                        Example: https://huggingface.co/meta-llama/Llama-2-7b
                      </p>
                    </div>

                    {/* Behavioral Tests Toggle */}
                    <div className="space-y-4 border-t border-white/10 pt-8">
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-all">
                        <div className="flex-1">
                          <Label className="text-gray-300 text-base font-semibold block mb-2">Behavioral Tests</Label>
                          <p className="text-gray-400 text-sm">Run comprehensive black-box behavioral tests to detect poisoning patterns</p>
                        </div>
                        <Switch
                          checked={runTests}
                          onCheckedChange={setRunTests}
                          className="accent-red-500 ml-4"
                        />
                      </div>
                      <p className="text-gray-500 text-xs ml-4">
                        {runTests ? "✓ Behavioral tests enabled - scan will take longer but be more thorough" : "○ Behavioral tests disabled - only file safety checks will run"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Info Card */}
              <div className="xl:col-span-1">
                <div className="space-y-6 h-full flex flex-col">
                  <Card className="glass-card border-blue-500/30 shadow-blue-500/20 flex-1">
                    <CardHeader className="pb-4 border-b border-white/5">
                      <CardTitle className="text-white text-lg flex items-center gap-2">
                        <Lock className="w-5 h-5 text-blue-400" />
                        Detection Checks
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5 pt-6">
                      <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <p className="text-blue-300 font-semibold mb-1 text-sm">📁 File Safety</p>
                        <p className="text-gray-400 text-xs">Format, serialization, suspicious patterns</p>
                      </div>
                      <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                        <p className="text-purple-300 font-semibold mb-1 text-sm">🔍 Behavioral Tests</p>
                        <p className="text-gray-400 text-xs">Refusal rates, triggers, consistency, injection</p>
                      </div>
                      <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                        <p className="text-yellow-300 font-semibold mb-1 text-sm">⚠️ Probabilistic</p>
                        <p className="text-gray-400 text-xs">Detection is probabilistic, not guaranteed</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Button
                    onClick={startScan}
                    disabled={!modelUrl.trim() || isLoading}
                    size="lg"
                    className="w-full h-14 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-lg hover:shadow-red-500/50 transition-all duration-300 hover-lift text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Search className="mr-2 h-5 w-5" />
                    {isLoading ? "Scanning..." : "Start Scan"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scanning Phase */}
        {scanPhase === "scanning" && (
          <div className="animate-fadeIn">
            <Card className="glass-card border-red-500/30 shadow-red-500/50">
              <CardHeader className="pb-8 border-b border-white/5">
                <CardTitle className="text-white text-3xl flex items-center gap-4 mb-2">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <Loader className="w-6 h-6 text-red-400 animate-spin" />
                  </div>
                  Scanning Model for Poisoning
                </CardTitle>
                <p className="text-gray-400 text-sm mt-2">Running comprehensive analysis on the selected model...</p>
              </CardHeader>
              <CardContent className="space-y-8 pt-8">
                {/* Progress Circle */}
                <div className="flex justify-center">
                  <div className="relative w-32 h-32 flex items-center justify-center">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#374151" strokeWidth="4" />
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
                          <stop offset="0%" stopColor="#ef4444" />
                          <stop offset="100%" stopColor="#f97316" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute text-center">
                      <div className="text-4xl font-bold text-transparent bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text">
                        {scanProgress}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Messages */}
                <div className="space-y-3">
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10 flex items-start gap-3">
                    <div className="text-lg">📋</div>
                    <div className="flex-1">
                      <p className="text-gray-300 font-medium">File Safety Analysis</p>
                      <p className="text-gray-400 text-sm">{scanProgress >= 30 ? "✓ In progress" : "Pending"}</p>
                    </div>
                  </div>
                  {runTests && (
                    <div className="p-4 bg-white/5 rounded-lg border border-white/10 flex items-start gap-3">
                      <div className="text-lg">🔍</div>
                      <div className="flex-1">
                        <p className="text-gray-300 font-medium">Behavioral Tests</p>
                        <p className="text-gray-400 text-sm">{scanProgress >= 60 ? "✓ In progress" : "Pending"}</p>
                      </div>
                    </div>
                  )}
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10 flex items-start gap-3">
                    <div className="text-lg">📊</div>
                    <div className="flex-1">
                      <p className="text-gray-300 font-medium">Risk Assessment</p>
                      <p className="text-gray-400 text-sm">{scanProgress >= 85 ? "✓ Calculating" : "Pending"}</p>
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
                className="border-red-500/30 text-red-400 hover:bg-red-500/20 bg-transparent/50 backdrop-blur-md hover-lift"
              >
                <Zap className="w-4 h-4 mr-2" />
                New Scan
              </Button>
              <Button
                onClick={() => downloadReport("json")}
                className="border-blue-500/30 text-blue-400 hover:bg-blue-500/20 bg-transparent/50 backdrop-blur-md hover-lift"
              >
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
            </div>

            {/* Verdict Card - Enhanced */}
            <Card className="glass-card border-red-500/30 shadow-red-500/20 overflow-hidden">
              <div className={`bg-gradient-to-r ${
                scanResult.verdict === "safe"
                  ? "from-green-600/20 to-emerald-600/20 border-green-500/20"
                  : scanResult.verdict === "unsafe"
                  ? "from-red-600/20 to-orange-600/20 border-red-500/20"
                  : "from-yellow-600/20 to-orange-600/20 border-yellow-500/20"
              } border-b px-8 py-8`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-4">
                      <Badge className={`${getVerdictColor(scanResult.verdict)} text-white capitalize flex items-center gap-2 px-4 py-2 text-lg`}>
                        {getVerdictIcon(scanResult.verdict)}
                        {scanResult.verdict.toUpperCase()}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300">Confidence:</span>
                        <div className="w-48 h-2 bg-gray-700/50 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              scanResult.verdict === "safe"
                                ? "bg-green-500"
                                : scanResult.verdict === "unsafe"
                                ? "bg-red-500"
                                : "bg-yellow-500"
                            }`}
                            style={{ width: `${scanResult.confidence * 100}%` }}
                          />
                        </div>
                        <span className="font-bold text-white min-w-12">{Math.round(scanResult.confidence * 100)}%</span>
                      </div>
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-white mb-2">{scanResult.model_id}</h2>
                      <p className="text-gray-300 text-lg leading-relaxed max-w-2xl">{scanResult.explanation}</p>
                    </div>
                  </div>
                </div>
              </div>

              <CardContent className="space-y-8 pt-8">
                {/* Risk Assessment */}
                {scanResult.risk_assessment && (
                  <div className="space-y-6 border-t border-white/10 pt-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-red-500/20 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                      </div>
                      <h3 className="text-2xl font-bold text-white">Risk Assessment</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {/* System Compromise Risk */}
                      <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-lg p-5 border border-red-500/20 hover:border-red-500/40 transition-all backdrop-blur-md group cursor-default">
                        <div className="flex items-center justify-between mb-4">
                          <label className="text-gray-300 text-sm font-bold">System Compromise</label>
                          <div className="text-2xl font-bold text-red-400 group-hover:scale-110 transition-transform">{Math.round(scanResult.risk_assessment.system_compromise_risk * 100)}%</div>
                        </div>
                        <div className="h-3 bg-gray-700/50 rounded-full overflow-hidden border border-white/10">
                          <div
                            className="h-full bg-gradient-to-r from-red-500 via-red-500 to-orange-500 rounded-full transition-all duration-500"
                            style={{ width: `${scanResult.risk_assessment.system_compromise_risk * 100}%` }}
                          />
                        </div>
                        <p className="text-gray-400 text-xs mt-3">Risk of unauthorized system access</p>
                      </div>

                      {/* Behavior Manipulation Risk */}
                      <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 rounded-lg p-5 border border-yellow-500/20 hover:border-yellow-500/40 transition-all backdrop-blur-md group cursor-default">
                        <div className="flex items-center justify-between mb-4">
                          <label className="text-gray-300 text-sm font-bold">Behavior Manipulation</label>
                          <div className="text-2xl font-bold text-yellow-400 group-hover:scale-110 transition-transform">{Math.round(scanResult.risk_assessment.behavior_manipulation_risk * 100)}%</div>
                        </div>
                        <div className="h-3 bg-gray-700/50 rounded-full overflow-hidden border border-white/10">
                          <div
                            className="h-full bg-gradient-to-r from-yellow-500 via-yellow-500 to-red-500 rounded-full transition-all duration-500"
                            style={{ width: `${scanResult.risk_assessment.behavior_manipulation_risk * 100}%` }}
                          />
                        </div>
                        <p className="text-gray-400 text-xs mt-3">Risk of model behavior modification</p>
                      </div>

                      {/* Combined Risk */}
                      <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-lg p-5 border border-purple-500/20 hover:border-purple-500/40 transition-all backdrop-blur-md group cursor-default">
                        <div className="flex items-center justify-between mb-4">
                          <label className="text-gray-300 text-sm font-bold">Combined Risk</label>
                          <div className="text-2xl font-bold text-purple-400 group-hover:scale-110 transition-transform">{Math.round(scanResult.risk_assessment.combined_risk_score * 100)}%</div>
                        </div>
                        <div className="h-3 bg-gray-700/50 rounded-full overflow-hidden border border-white/10">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 via-purple-500 to-red-500 rounded-full transition-all duration-500"
                            style={{ width: `${scanResult.risk_assessment.combined_risk_score * 100}%` }}
                          />
                        </div>
                        <p className="text-gray-400 text-xs mt-3">Overall risk assessment score</p>
                      </div>
                    </div>

                    {/* Recommendation */}
                    <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-lg p-6 backdrop-blur-md mt-6">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">💡</span>
                        <div className="flex-1">
                          <p className="text-blue-300 font-bold mb-2 text-lg">Recommendation</p>
                          <p className="text-gray-200 leading-relaxed">{scanResult.risk_assessment.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* File Safety */}
                {scanResult.file_safety && (
                  <div className="space-y-6 border-t border-white/10 pt-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Lock className="w-5 h-5 text-blue-400" />
                      </div>
                      <h3 className="text-2xl font-bold text-white">File Safety Analysis</h3>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className={`p-4 rounded-lg border backdrop-blur-md text-center ${scanResult.file_safety.has_safe_format ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                        <p className="text-gray-400 text-sm mb-2">Safe Format</p>
                        <p className={`text-xl font-bold ${scanResult.file_safety.has_safe_format ? "text-green-400" : "text-red-400"}`}>
                          {scanResult.file_safety.has_safe_format ? "✓" : "✗"}
                        </p>
                      </div>
                      <div className={`p-4 rounded-lg border backdrop-blur-md text-center ${!scanResult.file_safety.has_unsafe_serialization ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                        <p className="text-gray-400 text-sm mb-2">Unsafe Serialization</p>
                        <p className={`text-xl font-bold ${!scanResult.file_safety.has_unsafe_serialization ? "text-green-400" : "text-red-400"}`}>
                          {!scanResult.file_safety.has_unsafe_serialization ? "✓" : "✗"}
                        </p>
                      </div>
                      <div className={`p-4 rounded-lg border backdrop-blur-md text-center ${!scanResult.file_safety.has_suspicious_code ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                        <p className="text-gray-400 text-sm mb-2">Suspicious Code</p>
                        <p className={`text-xl font-bold ${!scanResult.file_safety.has_suspicious_code ? "text-green-400" : "text-red-400"}`}>
                          {!scanResult.file_safety.has_suspicious_code ? "✓" : "✗"}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg border bg-purple-500/10 border-purple-500/20 backdrop-blur-md text-center">
                        <p className="text-gray-400 text-sm mb-2">Risk Score</p>
                        <p className="text-xl font-bold text-purple-400">{Math.round(scanResult.file_safety.risk_score * 100)}%</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {scanResult.file_safety.details.map((detail, idx) => (
                        <div key={idx} className="flex items-start gap-4 p-4 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-all">
                          <div className="text-2xl mt-0.5 flex-shrink-0">
                            {detail.includes("✓") ? "✅" : "⚠️"}
                          </div>
                          <p className="text-gray-300 text-sm leading-relaxed">{detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Behavioral Tests */}
                {scanResult.behavioral_tests.length > 0 && (
                  <div className="space-y-6 border-t border-white/10 pt-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-purple-500/20 rounded-lg">
                        <Zap className="w-5 h-5 text-purple-400" />
                      </div>
                      <h3 className="text-2xl font-bold text-white">Behavioral Tests</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {scanResult.behavioral_tests.map((test, idx) => (
                        <div key={idx} className={`rounded-lg p-5 border backdrop-blur-md transition-all hover:border-white/20 ${test.passed ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="text-white font-bold text-lg">{test.test_name}</h4>
                              <p className="text-gray-400 text-sm mt-2">{test.details}</p>
                            </div>
                            <Badge className={`${test.passed ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} text-white whitespace-nowrap ml-3 px-3 py-1`}>
                              {test.passed ? "✓ PASS" : "✗ FAIL"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t border-white/10">
                            <span className="text-gray-400 text-xs">Confidence</span>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-gray-700/50 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${test.passed ? "bg-green-500" : "bg-red-500"}`}
                                  style={{ width: `${test.confidence * 100}%` }}
                                />
                              </div>
                              <span className="text-gray-300 font-semibold text-xs min-w-12">{Math.round(test.confidence * 100)}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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
