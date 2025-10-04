
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
        
        setVulnerabilities(convertedVulnerabilities)
        setIsScanning(false)
        setScanComplete(true)
      } else {
        throw new Error(response.error || "Scan failed")
      }
    } catch (error) {
      setError(error.message || "An error occurred during scanning")
      setIsScanning(false)
      setScanProgress(0)
    }
  }

  const exportReport = (format) => {
    console.log(`Exporting report as ${format}`)
  }

  const resetScan = () => {
    setIsScanning(false)
    setScanComplete(false)
    setScanProgress(0)
    setVulnerabilities([])
    setScanResults(null)
    setError(null)
    setFile(null)
    setRepoUrl("")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60"
      >
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 bg-green-600 rounded-lg">
            <Code className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">C/C++ Code Scanner</h1>
            <p className="text-gray-300">Comprehensive security analysis for C/C++ code vulnerabilities</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Scanner */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg border border-purple-700/60">
            <div className="flex border-b border-purple-800">
              {tabs.map((tab) => {
                const IconComponent = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center space-x-2 p-4 transition-colors ${
                      activeTab === tab.id
                        ? "bg-green-600 text-white"
                        : "text-gray-300 hover:bg-gradient-to-r hover:from-purple-800/80 hover:to-pink-800/60 hover:text-white"
                    }`}
                  >
                    <IconComponent className="h-4 w-4" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                )
              })}
            </div>
