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
                          className="h-32 bg-gray-900/80 backdrop-blur-md border border-white/20 text-black placeholder-gray-400 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all duration-300 resize-none"
                        />
                      </TabsContent>

