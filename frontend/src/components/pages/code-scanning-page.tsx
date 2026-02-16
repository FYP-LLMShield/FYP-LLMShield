import React, { useState } from "react";
import { scannerAPI } from '../../lib/api';
import { ScanResultsDisplay } from '../scanner/ScanResultsDisplay';

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import {
  Upload,
  Play,
  Pause,
  Square,
  Download,
  AlertTriangle,
  Shield,
  Bug,
  Zap,
  FileText,
  Code2,
  Search,
  Github,
  Target,
  Lock,
  Activity,
} from "lucide-react";

type InputMethod = "code" | "file" | "github";
type ScanPhase = "setup" | "scanning" | "results";

interface Vulnerability {
  id: string
  severity: "Critical" | "High" | "Medium" | "Low"
  type: string
  file: string
  line: number
  column: number
  description: string
  codeSnippet: string
  recommendation: string
  cwe: string
}

const initialVulnerabilities: Vulnerability[] = []

export function CodeScanningPage() {
  const [scanPhase, setScanPhase] = useState<ScanPhase>("setup")
  const [inputMethod, setInputMethod] = useState<InputMethod>("code")
  const [scanProgress, setScanProgress] = useState(0)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>(initialVulnerabilities)
  const [scanResults, setScanResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [codeInput, setCodeInput] = useState<string>("")
  const [repoUrl, setRepoUrl] = useState<string>("")
  const [scanConfig, setScanConfig] = useState({
    language: "cpp",
    scanType: "comprehensive",
    enableStaticAnalysis: true,
    enableDynamicAnalysis: false,
    enableMemoryChecks: true,
    enableSecurityRules: true,
    maxSeverity: "all",
    useCache: true,
    maxFileSize: 10,
    maxFiles: 100
  })
  
  const [cacheStats, setCacheStats] = useState<any>(null)
  const [showCacheDialog, setShowCacheDialog] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(Array.from(event.target.files))
    }
  }

  const startScan = async () => {
    try {
      setError(null)
      setScanPhase("scanning")
      setScanProgress(0)
      
      // Validate input based on method
      if (inputMethod === "code" && !codeInput.trim()) {
        throw new Error("Please enter some code to scan")
      }
      if (inputMethod === "file" && selectedFiles.length === 0) {
        throw new Error("Please select files to scan")
      }
      if (inputMethod === "github" && !repoUrl.trim()) {
        throw new Error("Please enter a GitHub repository URL")
      }

      // Simulate progress with faster updates for better UX
      const progressInterval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 500)

      let result: any
      if (inputMethod === "code") {
        result = await scannerAPI.scanText({ 
          content: codeInput,
          filename: "pasted_code.txt",
          scan_types: ["cpp_vulns"],
          use_cache: scanConfig.useCache
        })
      } else if (inputMethod === "file") {
        result = await scannerAPI.uploadFiles(
          selectedFiles, 
          ["cpp_vulns"], 
          scanConfig.useCache,
          scanConfig.maxFileSize,
          scanConfig.maxFiles
        )
      } else {
        result = await scannerAPI.scanRepository({ 
          repo_url: repoUrl,
          scan_types: ["cpp_vulns", "secrets"],
          use_cache: scanConfig.useCache,
          max_file_size_mb: scanConfig.maxFileSize,
          max_files: scanConfig.maxFiles
        })
      }

      if (!result.success) {
        throw new Error(result.error || "Scan failed")
      }
      
      clearInterval(progressInterval)
      setScanProgress(100)
      
      setTimeout(() => {
        const convertedVulnerabilities = result.data?.findings?.map((finding: any) => ({
          id: finding.id,
          severity: finding.severity,
          type: finding.type,
          file: finding.file,
          line: finding.line,
          column: finding.column,
          description: finding.message,
          codeSnippet: finding.snippet, // Changed from finding.code_snippet
          recommendation: finding.remediation, // Changed from finding.recommendation
          cwe: finding.cwe?.[0] || "", // Get first CWE or empty string
        })) || []
        
        setVulnerabilities(convertedVulnerabilities)
        setScanResults(result.data)
        setScanPhase("results")
      }, 1000)
      
    } catch (err: any) {
      setError(err.message || "An error occurred during scanning")
      setScanPhase("setup")
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "Critical":
        return "bg-red-600 hover:bg-red-700"
      case "High":
        return "bg-orange-600 hover:bg-orange-700"
      case "Medium":
        return "bg-yellow-600 hover:bg-yellow-700"
      case "Low":
        return "bg-blue-600 hover:bg-blue-700"
      default:
        return "bg-gray-600 hover:bg-gray-700"
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "Critical":
        return <AlertTriangle className="w-4 h-4" />
      case "High":
        return <Shield className="w-4 h-4" />
      case "Medium":
        return <Bug className="w-4 h-4" />
      case "Low":
        return <Zap className="w-4 h-4" />
      default:
        return <Activity className="w-4 h-4" />
    }
  }

  const resetScan = () => {
    setScanPhase("setup")
    setScanProgress(0)
    setVulnerabilities([])
    setScanResults(null)
    setError(null)
    setCodeInput("")
    setSelectedFiles([])
    setRepoUrl("")
  }
  
  // Cache management functions
  const getCacheStats = async () => {
    try {
      setError(null)
      const result = await scannerAPI.getCacheStats()
      if (result.success) {
        setCacheStats(result.data)
        setShowCacheDialog(true)
      } else {
        setError(result.error || "Failed to get cache statistics")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while getting cache statistics")
    }
  }
  
  const clearCache = async () => {
    try {
      setError(null)
      const result = await scannerAPI.clearCache()
      if (result.success) {
        // Update cache stats after clearing
        getCacheStats()
      } else {
        setError(result.error || "Failed to clear cache")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while clearing cache")
    }
  }

  const exportReport = (format: string = 'json') => {
    if (!scanResults || !vulnerabilities.length) {
      setError("No scan results to export")
      return
    }
    
    try {
      let content = ""
      let filename = `llmshield-scan-report-${new Date().toISOString().slice(0, 10)}`
      
      if (format === 'json') {
        content = JSON.stringify({
          scan_results: scanResults,
          vulnerabilities: vulnerabilities
        }, null, 2)
        filename += ".json"
      } else if (format === 'csv') {
        // Create CSV header
        content = "Severity,Type,File,Line,Column,Description,CWE\n"
        // Add each vulnerability as a row
        vulnerabilities.forEach(vuln => {
          content += `"${vuln.severity}","${vuln.type}","${vuln.file}",${vuln.line},${vuln.column},"${vuln.description}","${vuln.cwe}"\n`
        })
        filename += ".csv"
      }
      
      // Create a download link
      const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(`Failed to export report: ${err.message}`)
    }
  }

  // Function to download PDF report based on input method
  const downloadPdfReport = async () => {
    try {
      setError(null);
      setIsDownloadingPdf(true);

      let pdfBlob;
      if (inputMethod === "code") {
        if (!codeInput.trim()) {
          setError("No code content to generate PDF for. Please run a scan first.");
          setIsDownloadingPdf(false);
          return;
        }
        pdfBlob = await scannerAPI.getTextScanPDF({
          content: codeInput,
          scan_types: ["cpp_vulns"]
        });
      } else if (inputMethod === "file") {
        if (!selectedFiles.length) {
          setError("No files selected. Please run a scan first.");
          setIsDownloadingPdf(false);
          return;
        }
        pdfBlob = await scannerAPI.getUploadScanPDF(selectedFiles, ["cpp_vulns"]);
      } else if (inputMethod === "github") {
        if (!repoUrl.trim()) {
          setError("No repository URL provided. Please run a scan first.");
          setIsDownloadingPdf(false);
          return;
        }
        pdfBlob = await scannerAPI.getRepositoryScanPDF({
          repo_url: repoUrl,
          scan_types: ["cpp_vulns"]
        });
      }

      if (!pdfBlob) {
        setError("Failed to generate PDF: No response received from server");
        setIsDownloadingPdf(false);
        return;
      }

      if ((pdfBlob as any)?.success === false) {
        setError(`Failed to generate PDF: ${(pdfBlob as any)?.error || 'Unknown error'}`);
        setIsDownloadingPdf(false);
        return;
      }

      if ((pdfBlob as any)?.success && (pdfBlob as any)?.data) {
        // Create a download link for the PDF
        const url = URL.createObjectURL((pdfBlob as any).data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `llmshield-scan-report-${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setError("Failed to generate PDF: Invalid response structure");
      }
    } catch (err: any) {
      console.error("PDF Download Error:", err);
      setError(`Failed to download PDF report: ${err.message}`);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="min-h-screen p-6" style={{backgroundColor: '#1d2736'}}>
      {/* Cache Stats Dialog */}
      <Dialog open={showCacheDialog} onOpenChange={setShowCacheDialog}>
        <DialogContent className="bg-gray-900 border border-blue-500/30">
          <DialogHeader>
            <DialogTitle className="text-white">Cache Statistics</DialogTitle>
          </DialogHeader>
          <div className="text-gray-200">
            {cacheStats ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Cache Size:</span>
                  <span className="font-mono">{cacheStats.size_mb?.toFixed(2) || 0} MB</span>
                </div>
                <div className="flex justify-between">
                  <span>Items in Cache:</span>
                  <span className="font-mono">{cacheStats.items || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Hit Rate:</span>
                  <span className="font-mono">{((cacheStats.hit_rate || 0) * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Cleared:</span>
                  <span className="font-mono">{cacheStats.last_cleared || 'Never'}</span>
                </div>
              </div>
            ) : (
              <p>Loading cache statistics...</p>
            )}
          </div>
          <div className="flex justify-end mt-4">
            <Button 
              onClick={() => setShowCacheDialog(false)}
              variant="outline"
              className="border-blue-500/30 text-blue-400 hover:bg-blue-500/20 bg-transparent"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="animate-fadeIn">
            <h1 className="text-5xl font-bold gradient-text-cyber mb-4 animate-pulse-glow flex items-center gap-4" style={{lineHeight: '1.2', paddingBottom: '4px'}}>
              <Code2 className="w-12 h-12 text-blue-400" />
              C/C++ Code Scanning
            </h1>
            <p className="text-gray-300 text-lg">Advanced static analysis with vulnerability detection</p>
          </div>
          {scanPhase !== "setup" && (
            <Button
              onClick={resetScan}
              variant="outline"
              className="border-blue-500/30 text-blue-400 hover:bg-blue-500/20 bg-transparent hover-lift animate-glow"
            >
              <Zap className="mr-2 h-4 w-4" />
              New Scan
            </Button>
          )}
        </div>

        {scanPhase === "setup" && (
          <div className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <span className="text-red-800 font-medium">Error</span>
                </div>
                <p className="text-red-700 mt-1">{error}</p>
              </div>
            )}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-fadeIn">
              <div className="xl:col-span-3">
                <Card className="glass-card border-purple-500/30 shadow-purple-500/20 h-full">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-white text-xl flex items-center gap-3">
                      <Target className="w-5 h-5 text-purple-400" />
                      Input Method Selection
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs value={inputMethod} onValueChange={(value) => setInputMethod(value as InputMethod)}>
                      <TabsList className="grid w-full grid-cols-3 bg-white/5 backdrop-blur-md border border-white/10 mb-4">
                        <TabsTrigger
                          value="code"
                          className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600/30 data-[state=active]:to-blue-600/20 data-[state=active]:text-white transition-all duration-300"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Enter Code
                        </TabsTrigger>
                        <TabsTrigger
                          value="file"
                          className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600/30 data-[state=active]:to-blue-600/20 data-[state=active]:text-white transition-all duration-300"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload File
                        </TabsTrigger>
                        <TabsTrigger
                          value="github"
                          className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600/30 data-[state=active]:to-blue-600/20 data-[state=active]:text-white transition-all duration-300"
                        >
                          <Github className="w-4 h-4 mr-2" />
                          Github Repo Link
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="code" className="animate-fadeIn">
                        <Label className="text-gray-300 text-base mb-2 block">C/C++ Source Code</Label>
                        <Textarea
                          value={codeInput}
                          onChange={(e) => setCodeInput(e.target.value)}
                          placeholder="Enter your C/C++ code to analyze for vulnerabilities..."
                          className="h-32 bg-gray-900/80 backdrop-blur-md border border-white/20 text-black placeholder-gray-400 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all duration-300 resize-none"
                        />
                      </TabsContent>

                      <TabsContent value="file" className="animate-fadeIn">
                        <div className="border-2 border-dashed border-purple-500/30 rounded-xl p-8 text-center bg-gradient-to-br from-purple-500/5 to-transparent hover:border-purple-500/50 transition-all duration-300 hover-lift">
                          <Upload className="mx-auto h-12 w-12 text-purple-400 mb-4" />
                          <p className="text-white text-base mb-2">Drop files here or click to upload</p>
                          <p className="text-gray-400 text-sm mb-4">Supports .c, .cpp, .h, .hpp files up to 10MB</p>
                          <input
                            type="file"
                            multiple
                            accept=".c,.cpp,.h,.hpp,.cc,.cxx"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="file-upload"
                          />
                          <Button 
                            onClick={() => document.getElementById('file-upload')?.click()}
                            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Choose Files
                          </Button>
                        </div>
                        {selectedFiles.length > 0 && (
                          <div className="mt-4">
                            <Label className="text-gray-300 text-sm">Selected Files ({selectedFiles.length})</Label>
                            <div className="max-h-20 overflow-y-auto space-y-1 mt-2">
                              {selectedFiles.map((file, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-white/5 rounded text-sm">
                                  <span className="text-gray-300">{file.name}</span>
                                  <span className="text-gray-500">{(file.size / 1024).toFixed(1)} KB</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        

                        
                        {/* Hidden default values for advanced options */}
                        <div className="hidden">
                          <Switch 
                            checked={scanConfig.useCache} 
                            onCheckedChange={(checked) => setScanConfig({...scanConfig, useCache: checked})}
                          />
                          <Input
                            type="number"
                            value={scanConfig.maxFileSize}
                            onChange={(e) => setScanConfig({...scanConfig, maxFileSize: parseInt(e.target.value) || 10})}
                          />
                          <Input
                            type="number"
                            value={scanConfig.maxFiles}
                            onChange={(e) => setScanConfig({...scanConfig, maxFiles: parseInt(e.target.value) || 100})}
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="github" className="animate-fadeIn">
                        <div className="space-y-4">
                          <div>
                            <Label className="text-gray-300 text-base">Repository URL</Label>
                            <Input
                              value={repoUrl}
                              onChange={(e) => setRepoUrl(e.target.value)}
                              placeholder="https://github.com/username/repository"
                              className="bg-white/5 backdrop-blur-md border border-white/10 text-black placeholder-gray-400 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300"
                            />
                          </div>
                          
                          {/* Hidden default values for advanced options */}
                          <div className="hidden">
                            <Switch 
                              checked={scanConfig.useCache} 
                              onCheckedChange={(checked) => setScanConfig({...scanConfig, useCache: checked})}
                            />
                            <Input
                              type="number"
                              value={scanConfig.maxFileSize}
                              onChange={(e) => setScanConfig({...scanConfig, maxFileSize: parseInt(e.target.value) || 10})}
                            />
                            <Input
                              type="number"
                              value={scanConfig.maxFiles}
                              onChange={(e) => setScanConfig({...scanConfig, maxFiles: parseInt(e.target.value) || 100})}
                            />
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>

              <div className="xl:col-span-1">
                <Card className="glass-card border-green-500/30 shadow-green-500/20 h-full">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-white text-xl flex items-center gap-3">
                      <Lock className="w-5 h-5 text-green-400" />
                      Scan Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <Button
                        onClick={startScan}
                        disabled={(
                          (inputMethod === "code" && !codeInput.trim()) ||
                          (inputMethod === "file" && selectedFiles.length === 0) ||
                          (inputMethod === "github" && !repoUrl.trim())
                        )}
                        size="lg"
                        className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-blue-500/30 transition-all duration-300 hover-lift text-base font-semibold"
                      >
                        <Search className="mr-2 h-5 w-5" />
                        Start Scan
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {scanPhase === "scanning" && (
          <div className="animate-fadeIn">
            <Card className="glass-card border-blue-500/30 shadow-blue-500/20">
              <CardHeader>
                <CardTitle className="text-white text-2xl flex items-center gap-3">
                  <Search className="w-6 h-6 text-blue-400 animate-spin" />
                  Scanning in Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-blue-400 mb-2">{scanProgress}%</div>
                    <div className="text-gray-300 text-lg font-semibold">Scan Progress</div>
                  </div>
                  <div className="relative">
                    <Progress value={scanProgress} className="h-6 bg-gray-800/60" indicatorClassName="bg-blue-500" />
                    <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                      {scanProgress}% Complete
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {scanPhase === "results" && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex items-center justify-end mb-4">
              <div className="flex space-x-2">
                <Button 
                  onClick={resetScan}
                  variant="outline" 
                  className="border-blue-500/30 text-blue-400 hover:bg-blue-500/20 bg-transparent hover-lift"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  New Scan
                </Button>
                <Button 
                  onClick={() => exportReport('json')}
                  variant="outline" 
                  className="border-green-500/30 text-green-400 hover:bg-green-500/20 bg-transparent hover-lift"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export JSON
                </Button>
                <Button
                  onClick={downloadPdfReport}
                  disabled={isDownloadingPdf}
                  variant="outline"
                  className="border-purple-500/30 text-purple-400 hover:bg-purple-500/20 bg-transparent hover-lift disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {isDownloadingPdf ? "Generating PDF..." : "Download PDF Report"}
                </Button>
              </div>
            </div>
            
            {/* Use the shared ScanResultsDisplay component */}
            <ScanResultsDisplay 
              scanResults={scanResults} 
              vulnerabilities={vulnerabilities} 
              inputMethod={inputMethod}
              onDownloadPDF={downloadPdfReport}
            />
          </div>
        )}
      </div>
    </div>
  )
}
