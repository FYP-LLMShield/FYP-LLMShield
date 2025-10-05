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
