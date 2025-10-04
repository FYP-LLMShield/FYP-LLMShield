
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Code, Upload, Play, Download, MessageCircle, FileText, AlertTriangle, CheckCircle, Github } from "lucide-react"
import { scannerAPI } from '../../lib/api'

const CodeScannerPage = () => {
  const [activeTab, setActiveTab] = useState("upload")
  const [isScanning, setIsScanning] = useState(false)
  const [scanComplete, setScanComplete] = useState(false)
  const [file, setFile] = useState(null)
  const [repoUrl, setRepoUrl] = useState("")
  const [scanProgress, setScanProgress] = useState(0)
  const [vulnerabilities, setVulnerabilities] = useState([])
  const [scanResults, setScanResults] = useState(null)
  const [error, setError] = useState(null)

  const tabs = [
    { id: "upload", label: "Upload Code File", icon: Upload },
    { id: "github", label: "GitHub Repo Link", icon: Github },
  ]

  const startScan = async () => {
    setIsScanning(true)
    setScanProgress(0)
    setError(null)
    setScanComplete(false)

    try {
      let response
      
      // Progress simulation
      const progressInterval = setInterval(() => {
        setScanProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 15
        })
      }, 300)

      // Call appropriate API based on active tab
      if (activeTab === "upload" && file) {
        response = await scannerAPI.uploadFiles([file])
      } else if (activeTab === "github" && repoUrl.trim()) {
        response = await scannerAPI.scanRepository({ repo_url: repoUrl })
      } else {
        throw new Error("Please provide input for scanning")
      }

      clearInterval(progressInterval)
      setScanProgress(100)

      if (response.success && response.data) {
        setScanResults(response.data)
        
        // Convert API findings to frontend format
        const convertedVulnerabilities = response.data.findings?.map((finding) => ({
          id: finding.id,
          severity: finding.severity,
          type: finding.type,
          file: finding.file,
          line: finding.line,
          column: finding.column,
          description: finding.description,
          codeSnippet: finding.code_snippet,
          recommendation: finding.recommendation,
          cwe: finding.cwe,
        })) || []
