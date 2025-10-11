"use client"
import { useState } from "react"
import type React from "react"
import { scannerAPI } from '../../lib/api'

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Textarea } from "../ui/textarea"
import { Badge } from "../ui/badge"
import { Progress } from "../ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Switch } from "../ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
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
} from "lucide-react"

type InputMethod = "code" | "file" | "github"
type ScanPhase = "setup" | "scanning" | "results"

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
  })

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

      // Simulate progress
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
          scan_types: ["secrets", "cpp_vulns"]
        })
      } else if (inputMethod === "file") {
        result = await scannerAPI.uploadFiles(selectedFiles)
      } else {
        result = await scannerAPI.scanRepository({ 
          repo_url: repoUrl,
          scan_types: ["secrets", "cpp_vulns"] 
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

  return (
    <div className="min-h-screen p-6" style={{backgroundColor: '#1d2736'}}>
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
                          className="h-32 bg-gray-900/80 backdrop-blur-md border border-white/20 text-white placeholder-gray-400 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all duration-300 resize-none"
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
                      </TabsContent>

                      <TabsContent value="github" className="animate-fadeIn">
                        <div className="space-y-4">
                          <div>
                            <Label className="text-gray-300 text-base">Repository URL</Label>
                            <Input
                              value={repoUrl}
                              onChange={(e) => setRepoUrl(e.target.value)}
                              placeholder="https://github.com/username/repository"
                              className="bg-white/5 backdrop-blur-md border border-white/10 text-white placeholder-gray-400 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300"
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
                    <div className="space-y-4">
                      <div>
                        <Label className="text-gray-300 text-sm mb-2 block">Language</Label>
                        <Select value={scanConfig.language} onValueChange={(value) => setScanConfig({...scanConfig, language: value})}>
                          <SelectTrigger className="bg-white/5 backdrop-blur-md border border-white/10 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cpp">C++</SelectItem>
                            <SelectItem value="c">C</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <Button
                        onClick={startScan}
                        disabled={(
                          (inputMethod === "code" && !codeInput.trim()) ||
                          (inputMethod === "file" && selectedFiles.length === 0) ||
                          (inputMethod === "github" && !repoUrl.trim())
                        )}
                        size="sm"
                        className="w-full h-10 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg hover:shadow-green-500/30 transition-all duration-300 hover-lift text-sm font-semibold"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Quick Scan
                      </Button>
                      <Button
                        onClick={startScan}
                        disabled={(
                          (inputMethod === "code" && !codeInput.trim()) ||
                          (inputMethod === "file" && selectedFiles.length === 0) ||
                          (inputMethod === "github" && !repoUrl.trim())
                        )}
                        size="sm"
                        className="w-full h-10 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-purple-500/30 transition-all duration-300 hover-lift text-sm font-semibold"
                      >
                        <Search className="mr-2 h-4 w-4" />
                        Deep Scan
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
                    <Progress value={scanProgress} className="h-6 bg-gray-800/60" />
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-red-900/60 to-red-800/40 backdrop-blur-md border border-red-500/40 shadow-red-500/30 hover:shadow-red-500/50 hover-lift transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-red-500/20 rounded-xl border border-red-400/30">
                      <AlertTriangle className="w-8 h-8 text-red-300" />
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-white">{vulnerabilities.filter(v => v.severity === 'Critical').length}</div>
                      <div className="text-sm text-red-200 font-semibold">Critical Issues</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-orange-900/60 to-orange-800/40 backdrop-blur-md border border-orange-500/40 shadow-orange-500/30 hover:shadow-orange-500/50 hover-lift transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-orange-500/20 rounded-xl border border-orange-400/30">
                      <Shield className="w-8 h-8 text-orange-300" />
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-white">{vulnerabilities.filter(v => v.severity === 'High').length}</div>
                      <div className="text-sm text-orange-200 font-semibold">High Issues</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-yellow-900/60 to-yellow-800/40 backdrop-blur-md border border-yellow-500/40 shadow-yellow-500/30 hover:shadow-yellow-500/50 hover-lift transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-yellow-500/20 rounded-xl border border-yellow-400/30">
                      <Bug className="w-8 h-8 text-yellow-300" />
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-white">{vulnerabilities.filter(v => v.severity === 'Medium').length}</div>
                      <div className="text-sm text-yellow-200 font-semibold">Medium Issues</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-900/60 to-blue-800/40 backdrop-blur-md border border-blue-500/40 shadow-blue-500/30 hover:shadow-blue-500/50 hover-lift transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-400/30">
                      <Zap className="w-8 h-8 text-blue-300" />
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-white">{vulnerabilities.filter(v => v.severity === 'Low').length}</div>
                      <div className="text-sm text-blue-200 font-semibold">Low Issues</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="glass-card border-purple-500/30 shadow-purple-500/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-2xl flex items-center gap-3">
                    <Bug className="w-6 h-6 text-purple-400 animate-pulse" />
                    Code Analysis Results
                  </CardTitle>
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
                      Export Report
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {vulnerabilities.length === 0 ? (
                    <div className="text-center py-12">
                      <Shield className="mx-auto h-16 w-16 text-green-400 mb-4" />
                      <h3 className="text-xl font-semibold text-white mb-2">No Vulnerabilities Found</h3>
                      <p className="text-gray-400">Your code appears to be secure!</p>
                    </div>
                  ) : (
                    vulnerabilities.map((vuln) => (
                      <div key={vuln.id} className="bg-gradient-to-r from-gray-800/60 to-gray-700/40 backdrop-blur-md border border-gray-600/30 rounded-xl p-6 space-y-4 hover:from-gray-800/80 hover:to-gray-700/60 transition-all duration-300 shadow-lg hover:shadow-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <Badge className={`${getSeverityColor(vuln.severity)} text-white flex items-center gap-2 px-4 py-2 text-sm font-semibold shadow-lg`}>
                              {getSeverityIcon(vuln.severity)}
                              {vuln.severity}
                            </Badge>
                            <span className="text-white font-bold text-xl">{vuln.type}</span>
                            <span className="text-gray-300 text-sm bg-gray-700/50 px-3 py-1 rounded-full border border-gray-600/30">{vuln.cwe}</span>
                          </div>
                          <div className="text-sm text-gray-300 bg-gray-800/60 px-4 py-2 rounded-lg border border-gray-600/30 font-mono">
                            {vuln.file}:{vuln.line}:{vuln.column}
                          </div>
                        </div>

                        <p className="text-gray-100 text-lg leading-relaxed">{vuln.description}</p>

                        <div className="bg-gray-900/80 rounded-xl p-5 border border-gray-600/40 shadow-inner">
                          <Label className="text-gray-300 text-sm font-bold uppercase tracking-wider mb-3 block">Code Snippet</Label>
                          <pre className="text-sm text-green-300 font-mono bg-black/40 p-4 rounded-lg border border-gray-700/50 overflow-x-auto">
                            <code>{vuln.codeSnippet}</code>
                          </pre>
                        </div>

                        <div className="bg-gradient-to-r from-blue-900/60 to-indigo-900/40 rounded-xl p-5 border border-blue-500/30 shadow-inner">
                          <Label className="text-blue-200 text-sm font-bold uppercase tracking-wider mb-3 block">Recommendation</Label>
                          <p className="text-blue-100 text-lg leading-relaxed">{vuln.recommendation}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
