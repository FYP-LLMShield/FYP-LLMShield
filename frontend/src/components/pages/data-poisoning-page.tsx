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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-4 bg-gradient-to-br from-blue-500/30 to-indigo-500/20 rounded-xl border border-blue-400/50 shadow-xl shadow-blue-500/20">
                  <Database className="w-10 h-10 text-blue-300" />
                </div>
                <div>
                  <h1 className="text-6xl font-black bg-gradient-to-r from-blue-300 via-cyan-300 to-blue-300 bg-clip-text text-transparent mb-2" style={{lineHeight: '1.1'}}>
                    Data Poisoning Detection
                  </h1>
                  <p className="text-gray-300 text-lg font-semibold">Advanced behavioral analysis for Hugging Face models</p>
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
                    <p className="text-gray-300 text-base mt-3 font-medium">Enter a Hugging Face model URL to analyze</p>
                  </CardHeader>
                  <CardContent className="space-y-8 pt-8">
                    {/* Model URL Input */}
                    <div className="space-y-4">
                      <Label className="text-blue-100 text-lg font-bold block">🔗 Model Repository URL</Label>
                      <div className="relative group">
                        <Input
                          value={modelUrl}
                          onChange={(e) => setModelUrl(e.target.value)}
                          placeholder="https://huggingface.co/meta-llama/Llama-2-7b"
                          className="w-full bg-slate-800 border-2 border-blue-400/60 hover:border-blue-300 focus:border-blue-200 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 transition-all duration-300 py-4 px-5 text-base rounded-lg"
                        />
                      </div>
                      <div className="bg-blue-950/30 border border-blue-500/40 rounded-lg p-4">
                        <p className="text-blue-200 text-sm font-medium">
                          ✨ Tip: Enter any public Hugging Face model URL (e.g., meta-llama/Llama-2-7b, mistralai/Mistral-7B-v0.1)
                        </p>
                      </div>
                    </div>

                    {/* Behavioral Tests Toggle */}
                    <div className="space-y-4 border-t border-blue-500/30 pt-8">
                      <div className="flex items-center justify-between p-6 bg-gradient-to-r from-indigo-950/50 to-blue-950/30 rounded-xl border-2 border-indigo-500/50 hover:border-indigo-400 transition-all">
                        <div className="flex-1">
                          <Label className="text-blue-100 text-lg font-bold block mb-2 flex items-center gap-2">
                            <Zap className="w-6 h-6 text-indigo-400" />
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
                  </CardContent>
                </Card>
              </div>

              {/* Features & CTA Card */}
              <div className="lg:col-span-1">
                <div className="space-y-6 h-full flex flex-col">
                  <Card className="border-2 border-indigo-500/60 shadow-xl shadow-indigo-500/20 flex-1 bg-gradient-to-br from-slate-900 to-slate-800">
                    <CardHeader className="pb-4 border-b border-indigo-500/40 bg-gradient-to-r from-indigo-950/50 to-transparent">
                      <CardTitle className="text-blue-100 text-xl font-bold flex items-center gap-2">
                        <Shield className="w-6 h-6 text-indigo-400" />
                        What We Check
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      <div className="p-4 bg-gradient-to-br from-blue-950/50 to-blue-900/30 rounded-lg border border-blue-500/40 hover:border-blue-400 transition-all">
                        <p className="text-blue-200 font-bold mb-2 text-sm flex items-center gap-2">
                          <Activity className="w-4 h-4" /> File Safety
                        </p>
                        <p className="text-gray-300 text-xs">Format, serialization, code</p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-indigo-950/50 to-indigo-900/30 rounded-lg border border-indigo-500/40 hover:border-indigo-400 transition-all">
                        <p className="text-indigo-200 font-bold mb-2 text-sm flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" /> Behavioral Tests
                        </p>
                        <p className="text-gray-300 text-xs">Safety, triggers, consistency</p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-purple-950/50 to-purple-900/30 rounded-lg border border-purple-500/40 hover:border-purple-400 transition-all">
                        <p className="text-purple-200 font-bold mb-2 text-sm flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" /> Risk Scoring
                        </p>
                        <p className="text-gray-300 text-xs">System & behavior risks</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Button
                    onClick={startScan}
                    disabled={!modelUrl.trim() || isLoading}
                    className="w-full h-16 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:via-indigo-700 hover:to-blue-700 text-white shadow-xl hover:shadow-blue-500/50 transition-all duration-300 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                  >
                    <Search className="mr-3 h-6 w-6" />
                    {isLoading ? "Analyzing..." : "Start Scan"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scanning Phase */}
        {scanPhase === "scanning" && (
          <div className="animate-fadeIn">
            <Card className="border-2 border-blue-500/60 shadow-2xl shadow-blue-500/40 bg-gradient-to-br from-slate-900 to-slate-800">
              <CardHeader className="pb-8 border-b border-blue-500/40 bg-gradient-to-r from-blue-950/50 to-transparent">
                <CardTitle className="text-white text-4xl font-bold flex items-center gap-4 mb-3">
                  <div className="p-3 bg-gradient-to-br from-blue-500/40 to-indigo-500/30 rounded-lg">
                    <Loader className="w-8 h-8 text-blue-300 animate-spin" />
                  </div>
                  Analyzing Your Model
                </CardTitle>
                <p className="text-blue-100 text-lg mt-2 font-semibold">Running advanced poisoning detection analysis...</p>
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
                  <div className={`p-5 rounded-xl border-2 flex items-start gap-4 transition-all ${scanProgress >= 30 ? "bg-blue-950/50 border-blue-500/60" : "bg-slate-900/40 border-slate-600/40"}`}>
                    <div className={`text-2xl font-bold ${scanProgress >= 30 ? "text-blue-400" : "text-gray-500"}`}>{scanProgress >= 30 ? "✓" : "○"}</div>
                    <div className="flex-1">
                      <p className={`font-bold text-lg ${scanProgress >= 30 ? "text-blue-200" : "text-gray-300"}`}>File Safety Analysis</p>
                      <p className="text-gray-400 text-sm mt-1">{scanProgress >= 30 ? "✅ Checking formats, serialization, code patterns" : "⏳ Waiting to start..."}</p>
                    </div>
                  </div>
                  {runTests && (
                    <div className={`p-5 rounded-xl border-2 flex items-start gap-4 transition-all ${scanProgress >= 60 ? "bg-indigo-950/50 border-indigo-500/60" : "bg-slate-900/40 border-slate-600/40"}`}>
                      <div className={`text-2xl font-bold ${scanProgress >= 60 ? "text-indigo-400" : "text-gray-500"}`}>{scanProgress >= 60 ? "✓" : "○"}</div>
                      <div className="flex-1">
                        <p className={`font-bold text-lg ${scanProgress >= 60 ? "text-indigo-200" : "text-gray-300"}`}>Behavioral Tests</p>
                        <p className="text-gray-400 text-sm mt-1">{scanProgress >= 60 ? "✅ Testing safety, triggers, consistency" : "⏳ Waiting to start..."}</p>
                      </div>
                    </div>
                  )}
                  <div className={`p-5 rounded-xl border-2 flex items-start gap-4 transition-all ${scanProgress >= 85 ? "bg-purple-950/50 border-purple-500/60" : "bg-slate-900/40 border-slate-600/40"}`}>
                    <div className={`text-2xl font-bold ${scanProgress >= 85 ? "text-purple-400" : "text-gray-500"}`}>{scanProgress >= 85 ? "✓" : "○"}</div>
                    <div className="flex-1">
                      <p className={`font-bold text-lg ${scanProgress >= 85 ? "text-purple-200" : "text-gray-300"}`}>Risk Assessment</p>
                      <p className="text-gray-400 text-sm mt-1">{scanProgress >= 85 ? "✅ Computing risk scores and recommendation" : "⏳ Waiting to start..."}</p>
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

            {/* Verdict Card - Enhanced */}
            <Card className="glass-card border-cyan-500/40 shadow-lg shadow-cyan-500/20 overflow-hidden bg-gradient-to-br from-slate-900/80 to-slate-800/50">
              <div className={`bg-gradient-to-r ${
                scanResult.verdict === "safe"
                  ? "from-emerald-600/25 to-cyan-600/20 border-emerald-500/30"
                  : scanResult.verdict === "unsafe"
                  ? "from-red-600/25 to-orange-600/20 border-red-500/30"
                  : "from-yellow-600/25 to-amber-600/20 border-yellow-500/30"
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
                  <div className="space-y-6 border-t border-cyan-500/20 pt-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-gradient-to-br from-red-500/30 to-orange-500/20 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                      </div>
                      <h3 className="text-2xl font-bold text-white">Risk Assessment</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {/* System Compromise Risk */}
                      <div className="bg-gradient-to-br from-red-500/15 to-red-600/5 rounded-xl p-5 border border-red-500/30 hover:border-red-500/50 transition-all backdrop-blur-md group cursor-default shadow-lg shadow-red-500/10">
                        <div className="flex items-center justify-between mb-4">
                          <label className="text-gray-200 text-sm font-bold">System Compromise</label>
                          <div className="text-2xl font-bold text-red-400 group-hover:scale-110 transition-transform">{Math.round(scanResult.risk_assessment.system_compromise_risk * 100)}%</div>
                        </div>
                        <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden border border-red-500/20">
                          <div
                            className="h-full bg-gradient-to-r from-red-500 via-red-500 to-orange-500 rounded-full transition-all duration-500"
                            style={{ width: `${scanResult.risk_assessment.system_compromise_risk * 100}%` }}
                          />
                        </div>
                        <p className="text-gray-300 text-xs mt-3 font-medium">Unauthorized access risk</p>
                      </div>

                      {/* Behavior Manipulation Risk */}
                      <div className="bg-gradient-to-br from-amber-500/15 to-yellow-600/5 rounded-xl p-5 border border-amber-500/30 hover:border-amber-500/50 transition-all backdrop-blur-md group cursor-default shadow-lg shadow-amber-500/10">
                        <div className="flex items-center justify-between mb-4">
                          <label className="text-gray-200 text-sm font-bold">Behavior Manipulation</label>
                          <div className="text-2xl font-bold text-amber-400 group-hover:scale-110 transition-transform">{Math.round(scanResult.risk_assessment.behavior_manipulation_risk * 100)}%</div>
                        </div>
                        <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden border border-amber-500/20">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 via-yellow-500 to-red-500 rounded-full transition-all duration-500"
                            style={{ width: `${scanResult.risk_assessment.behavior_manipulation_risk * 100}%` }}
                          />
                        </div>
                        <p className="text-gray-300 text-xs mt-3 font-medium">Behavior modification risk</p>
                      </div>

                      {/* Combined Risk */}
                      <div className="bg-gradient-to-br from-purple-500/15 to-purple-600/5 rounded-xl p-5 border border-purple-500/30 hover:border-purple-500/50 transition-all backdrop-blur-md group cursor-default shadow-lg shadow-purple-500/10">
                        <div className="flex items-center justify-between mb-4">
                          <label className="text-gray-200 text-sm font-bold">Combined Risk</label>
                          <div className="text-2xl font-bold text-purple-400 group-hover:scale-110 transition-transform">{Math.round(scanResult.risk_assessment.combined_risk_score * 100)}%</div>
                        </div>
                        <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden border border-purple-500/20">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 rounded-full transition-all duration-500"
                            style={{ width: `${scanResult.risk_assessment.combined_risk_score * 100}%` }}
                          />
                        </div>
                        <p className="text-gray-300 text-xs mt-3 font-medium">Overall risk score</p>
                      </div>
                    </div>

                    {/* Recommendation */}
                    <div className="bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-purple-500/10 border border-cyan-500/40 rounded-xl p-6 backdrop-blur-md mt-6 shadow-lg shadow-cyan-500/10">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">💡</span>
                        <div className="flex-1">
                          <p className="text-cyan-300 font-bold mb-2 text-lg">Recommendation</p>
                          <p className="text-gray-200 leading-relaxed font-medium">{scanResult.risk_assessment.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* File Safety */}
                {scanResult.file_safety && (
                  <div className="space-y-6 border-t border-cyan-500/20 pt-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-gradient-to-br from-cyan-500/30 to-blue-500/20 rounded-lg">
                        <Lock className="w-5 h-5 text-cyan-400" />
                      </div>
                      <h3 className="text-2xl font-bold text-white">File Safety Analysis</h3>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className={`p-4 rounded-lg border backdrop-blur-md text-center transition-all ${scanResult.file_safety.has_safe_format ? "bg-emerald-500/15 border-emerald-500/40 shadow-lg shadow-emerald-500/10" : "bg-red-500/15 border-red-500/40 shadow-lg shadow-red-500/10"}`}>
                        <p className="text-gray-300 text-sm mb-2 font-medium">Safe Format</p>
                        <p className={`text-xl font-bold ${scanResult.file_safety.has_safe_format ? "text-emerald-400" : "text-red-400"}`}>
                          {scanResult.file_safety.has_safe_format ? "✓" : "✗"}
                        </p>
                      </div>
                      <div className={`p-4 rounded-lg border backdrop-blur-md text-center transition-all ${!scanResult.file_safety.has_unsafe_serialization ? "bg-emerald-500/15 border-emerald-500/40 shadow-lg shadow-emerald-500/10" : "bg-red-500/15 border-red-500/40 shadow-lg shadow-red-500/10"}`}>
                        <p className="text-gray-300 text-sm mb-2 font-medium">Unsafe Serialization</p>
                        <p className={`text-xl font-bold ${!scanResult.file_safety.has_unsafe_serialization ? "text-emerald-400" : "text-red-400"}`}>
                          {!scanResult.file_safety.has_unsafe_serialization ? "✓" : "✗"}
                        </p>
                      </div>
                      <div className={`p-4 rounded-lg border backdrop-blur-md text-center transition-all ${!scanResult.file_safety.has_suspicious_code ? "bg-emerald-500/15 border-emerald-500/40 shadow-lg shadow-emerald-500/10" : "bg-red-500/15 border-red-500/40 shadow-lg shadow-red-500/10"}`}>
                        <p className="text-gray-300 text-sm mb-2 font-medium">Suspicious Code</p>
                        <p className={`text-xl font-bold ${!scanResult.file_safety.has_suspicious_code ? "text-emerald-400" : "text-red-400"}`}>
                          {!scanResult.file_safety.has_suspicious_code ? "✓" : "✗"}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg border bg-gradient-to-br from-purple-500/15 to-pink-500/10 border-purple-500/30 backdrop-blur-md text-center shadow-lg shadow-purple-500/10 transition-all hover:border-purple-500/50">
                        <p className="text-gray-300 text-sm mb-2 font-medium">Risk Score</p>
                        <p className="text-xl font-bold text-purple-400">{Math.round(scanResult.file_safety.risk_score * 100)}%</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {scanResult.file_safety.details.map((detail, idx) => (
                        <div key={idx} className="flex items-start gap-4 p-4 bg-gradient-to-r from-slate-800/50 to-slate-700/30 rounded-lg border border-slate-600/30 hover:border-slate-500/50 transition-all hover:bg-slate-800/70">
                          <div className="text-2xl mt-0.5 flex-shrink-0">
                            {detail.includes("✓") ? "✅" : "⚠️"}
                          </div>
                          <p className="text-gray-200 text-sm leading-relaxed font-medium">{detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Behavioral Tests */}
                {scanResult.behavioral_tests.length > 0 && (
                  <div className="space-y-6 border-t border-cyan-500/20 pt-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-gradient-to-br from-blue-500/30 to-purple-500/20 rounded-lg">
                        <Zap className="w-5 h-5 text-blue-400" />
                      </div>
                      <h3 className="text-2xl font-bold text-white">Behavioral Tests</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {scanResult.behavioral_tests.map((test, idx) => (
                        <div key={idx} className={`rounded-xl p-5 border backdrop-blur-md transition-all hover:border-opacity-100 shadow-lg ${test.passed ? "bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/40 hover:border-emerald-500/60 shadow-emerald-500/10" : "bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/40 hover:border-red-500/60 shadow-red-500/10"}`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="text-white font-bold text-lg">{test.test_name}</h4>
                              <p className="text-gray-300 text-sm mt-2">{test.details}</p>
                            </div>
                            <Badge className={`${test.passed ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"} text-white whitespace-nowrap ml-3 px-3 py-1 font-semibold`}>
                              {test.passed ? "✓ PASS" : "✗ FAIL"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t border-white/10">
                            <span className="text-gray-300 text-xs font-medium">Confidence</span>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-slate-700/50 rounded-full overflow-hidden border border-white/10">
                                <div
                                  className={`h-full ${test.passed ? "bg-emerald-500" : "bg-red-500"}`}
                                  style={{ width: `${test.confidence * 100}%` }}
                                />
                              </div>
                              <span className="text-gray-200 font-semibold text-xs min-w-12">{Math.round(test.confidence * 100)}%</span>
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
