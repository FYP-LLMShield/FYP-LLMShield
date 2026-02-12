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
    <div className="min-h-screen p-6" style={{backgroundColor: '#1d2736'}}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="animate-fadeIn">
            <h1 className="text-5xl font-bold gradient-text-cyber mb-4 animate-pulse-glow flex items-center gap-4" style={{lineHeight: '1.2', paddingBottom: '4px'}}>
              <Database className="w-12 h-12 text-red-400" />
              Model Poisoning Detection
            </h1>
            <p className="text-gray-300 text-lg">Advanced behavioral analysis and file safety checks for Hugging Face models</p>
          </div>
          {scanPhase !== "setup" && (
            <Button
              onClick={resetScan}
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/20 bg-transparent hover-lift animate-glow"
            >
              <Zap className="mr-2 h-4 w-4" />
              New Scan
            </Button>
          )}
        </div>

        {/* Setup Phase */}
        {scanPhase === "setup" && (
          <div className="space-y-6">
            {error && (
              <div className="bg-red-50/10 border border-red-200/30 rounded-lg p-4 backdrop-blur-md">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <span className="text-red-300 font-medium">Error</span>
                </div>
                <p className="text-red-200 mt-1">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-fadeIn">
              {/* Main Input Card */}
              <div className="xl:col-span-3">
                <Card className="glass-card border-red-500/30 shadow-red-500/20 h-full">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-white text-xl flex items-center gap-3">
                      <Database className="w-5 h-5 text-red-400" />
                      Model Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Model URL Input */}
                    <div className="space-y-3">
                      <Label className="text-gray-300 text-base">Hugging Face Model URL</Label>
                      <Input
                        value={modelUrl}
                        onChange={(e) => setModelUrl(e.target.value)}
                        placeholder="https://huggingface.co/username/model-name"
                        className="bg-white/5 backdrop-blur-md border border-white/10 text-white placeholder-gray-400 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all duration-300"
                      />
                      <p className="text-gray-400 text-sm">
                        Example: https://huggingface.co/meta-llama/Llama-2-7b
                      </p>
                    </div>

                    {/* Behavioral Tests Toggle */}
                    <div className="space-y-3 border-t border-white/10 pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-gray-300 text-base">Behavioral Tests</Label>
                          <p className="text-gray-400 text-sm mt-1">Run comprehensive black-box behavioral tests (slower but more thorough)</p>
                        </div>
                        <Switch
                          checked={runTests}
                          onCheckedChange={setRunTests}
                          className="accent-red-500"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Info Card */}
              <div className="xl:col-span-1">
                <Card className="glass-card border-blue-500/30 shadow-blue-500/20 h-full">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-white text-xl flex items-center gap-3">
                      <Lock className="w-5 h-5 text-blue-400" />
                      What We Check
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div>
                      <p className="text-blue-300 font-semibold mb-2">✓ File Safety</p>
                      <p className="text-gray-400">Format, serialization, suspicious patterns</p>
                    </div>
                    <div className="border-t border-white/10 pt-4">
                      <p className="text-blue-300 font-semibold mb-2">✓ Behavioral Tests</p>
                      <p className="text-gray-400">Refusal rates, triggers, consistency, context injection</p>
                    </div>
                    <div className="border-t border-white/10 pt-4">
                      <p className="text-blue-300 font-semibold mb-2">⚠️ Probabilistic</p>
                      <p className="text-gray-400">Detection is probabilistic, not guaranteed</p>
                    </div>

                    <div className="border-t border-white/10 pt-4">
                      <Button
                        onClick={startScan}
                        disabled={!modelUrl.trim() || isLoading}
                        size="lg"
                        className="w-full h-12 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-lg hover:shadow-red-500/30 transition-all duration-300 hover-lift text-base font-semibold"
                      >
                        <Search className="mr-2 h-5 w-5" />
                        {isLoading ? "Scanning..." : "Start Scan"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* Scanning Phase */}
        {scanPhase === "scanning" && (
          <div className="animate-fadeIn">
            <Card className="glass-card border-red-500/30 shadow-red-500/20">
              <CardHeader>
                <CardTitle className="text-white text-2xl flex items-center gap-3">
                  <Loader className="w-6 h-6 text-red-400 animate-spin" />
                  Scanning Model for Poisoning
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-red-400 mb-2">{scanProgress}%</div>
                    <div className="text-gray-300 text-lg font-semibold">Scan Progress</div>
                  </div>
                  <div className="relative">
                    <Progress value={scanProgress} className="h-6 bg-gray-800/60" indicatorClassName="bg-red-500" />
                    <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                      {scanProgress}% Complete
                    </div>
                  </div>
                  <p className="text-center text-gray-400 text-sm">
                    Running file safety checks and behavioral tests...
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results Phase */}
        {scanPhase === "results" && scanResult && (
          <div className="space-y-8 animate-fadeIn">
            {/* Action Buttons */}
            <div className="flex items-center justify-end mb-4 gap-2">
              <Button
                onClick={resetScan}
                variant="outline"
                className="border-red-500/30 text-red-400 hover:bg-red-500/20 bg-transparent hover-lift"
              >
                <Zap className="w-4 h-4 mr-2" />
                New Scan
              </Button>
              <Button
                onClick={() => downloadReport("json")}
                variant="outline"
                className="border-blue-500/30 text-blue-400 hover:bg-blue-500/20 bg-transparent hover-lift"
              >
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
            </div>

            {/* Verdict Card */}
            <Card className="glass-card border-red-500/30 shadow-red-500/20">
              <div className="bg-gradient-to-r from-red-600/20 to-orange-600/20 border-b border-red-500/20 px-6 py-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Badge className={`${getVerdictColor(scanResult.verdict)} text-white capitalize flex items-center gap-2`}>
                        {getVerdictIcon(scanResult.verdict)}
                        {scanResult.verdict}
                      </Badge>
                      <span className="text-gray-300 text-sm">Confidence: <span className="font-bold text-white">{Math.round(scanResult.confidence * 100)}%</span></span>
                    </div>
                    <h2 className="text-2xl font-bold text-white">{scanResult.model_id}</h2>
                    <p className="text-gray-300">{scanResult.explanation}</p>
                  </div>
                </div>
              </div>

              <CardContent className="space-y-8 pt-6">
                {/* Risk Assessment */}
                {scanResult.risk_assessment && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-white">Risk Assessment</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* System Compromise Risk */}
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10 backdrop-blur-md">
                        <label className="text-gray-400 text-sm font-semibold mb-3 block">System Compromise Risk</label>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-2xl font-bold text-red-400">{Math.round(scanResult.risk_assessment.system_compromise_risk * 100)}%</div>
                        </div>
                        <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full"
                            style={{ width: `${scanResult.risk_assessment.system_compromise_risk * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Behavior Manipulation Risk */}
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10 backdrop-blur-md">
                        <label className="text-gray-400 text-sm font-semibold mb-3 block">Behavior Manipulation Risk</label>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-2xl font-bold text-yellow-400">{Math.round(scanResult.risk_assessment.behavior_manipulation_risk * 100)}%</div>
                        </div>
                        <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-yellow-500 to-red-500 rounded-full"
                            style={{ width: `${scanResult.risk_assessment.behavior_manipulation_risk * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Combined Risk */}
                      <div className="bg-white/5 rounded-lg p-4 border border-white/10 backdrop-blur-md">
                        <label className="text-gray-400 text-sm font-semibold mb-3 block">Combined Risk Score</label>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-2xl font-bold text-purple-400">{Math.round(scanResult.risk_assessment.combined_risk_score * 100)}%</div>
                        </div>
                        <div className="h-2 bg-gray-700/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-red-500 rounded-full"
                            style={{ width: `${scanResult.risk_assessment.combined_risk_score * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Recommendation */}
                    <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-lg p-4 backdrop-blur-md">
                      <p className="text-yellow-300 font-semibold mb-2">Recommendation</p>
                      <p className="text-gray-200">{scanResult.risk_assessment.recommendation}</p>
                    </div>
                  </div>
                )}

                {/* File Safety */}
                {scanResult.file_safety && (
                  <div className="space-y-4 border-t border-white/10 pt-6">
                    <h3 className="text-xl font-bold text-white">File Safety Analysis</h3>
                    <div className="space-y-3">
                      {scanResult.file_safety.details.map((detail, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                          <div className="text-lg mt-0.5">
                            {detail.includes("✓") ? "✓" : "⚠️"}
                          </div>
                          <p className="text-gray-300 text-sm">{detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Behavioral Tests */}
                {scanResult.behavioral_tests.length > 0 && (
                  <div className="space-y-4 border-t border-white/10 pt-6">
                    <h3 className="text-xl font-bold text-white">Behavioral Tests</h3>
                    <div className="space-y-3">
                      {scanResult.behavioral_tests.map((test, idx) => (
                        <div key={idx} className="bg-white/5 rounded-lg p-4 border border-white/10 backdrop-blur-md">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="text-white font-semibold">{test.test_name}</h4>
                              <p className="text-gray-400 text-sm mt-1">{test.details}</p>
                            </div>
                            <Badge className={`${test.passed ? "bg-green-600" : "bg-red-600"} text-white whitespace-nowrap ml-4`}>
                              {test.passed ? "✓ PASS" : "✗ FAIL"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <span>Confidence: {Math.round(test.confidence * 100)}%</span>
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
