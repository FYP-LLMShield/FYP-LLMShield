
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

             <div className="p-6">
              <AnimatePresence mode="wait">
                {activeTab === "upload" && (
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="border-2 border-dashed border-purple-700 rounded-lg p-8 text-center">
                      <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-300 mb-2">Upload your C/C++ source files</p>
                      <p className="text-gray-500 text-sm">Supports .c, .cpp, .h, .hpp files</p>
                      <input
                        type="file"
                        multiple
                        onChange={(e) => setFile(e.target.files[0])}
                        className="hidden"
                        accept=".c,.cpp,.h,.hpp,.cc,.cxx"
                        id="file-upload-scanner"
                      />
                      <button 
                        onClick={() => document.getElementById('file-upload-scanner')?.click()}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors"
                      >
                        Choose Files
                      </button>
                    </div>
                    {file && (
                      <div className="bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-lg p-3 flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-purple-400" />
                        <span className="text-white">{file.name}</span>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === "github" && (
                  <motion.div
                    key="github"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <label className="block text-white font-medium mb-2">GitHub Repository URL:</label>
                    <input
                      type="url"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      placeholder="https://github.com/username/repository"
                      className="w-full bg-gradient-to-r from-purple-700/80 to-pink-700/60 border border-purple-500/70 rounded-lg p-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                    <div className="bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-lg p-4">
                      <p className="text-gray-300 text-sm">
                        <strong>Note:</strong> Make sure the repository is public or provide access credentials for
                        private repositories.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error Display */}
              {error && (
                <div className="mt-4 bg-red-900/30 border border-red-700 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                    <span className="text-red-400 font-medium">Error</span>
                  </div>
                  <p className="text-gray-300 mt-2">{error}</p>
                </div>
              )}

              {/* Scan Options */}
              <div className="mt-6 border-t border-purple-800 pt-4">
                <h4 className="text-white font-medium mb-3">Scan Options</h4>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span className="text-gray-300 text-sm">Buffer Overflow Detection</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span className="text-gray-300 text-sm">Memory Leak Analysis</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span className="text-gray-300 text-sm">SQL Injection Patterns</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span className="text-gray-300 text-sm">Format String Vulnerabilities</span>
                  </label>
                </div>
              </div>

               {/* Scan Button */}
              <motion.button
                onClick={startScan}
                disabled={isScanning || (!file && activeTab === "upload") || (!repoUrl.trim() && activeTab === "github")}
                className="w-full mt-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Play className="h-5 w-5" />
                <span>{isScanning ? "Scanning Code..." : "Start Code Scan"}</span>
              </motion.button>

              {/* Progress Bar */}
              {isScanning && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
                  <div className="bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="h-full bg-green-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${scanProgress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <p className="text-center text-gray-300 mt-2">Analyzing code... {scanProgress}%</p>
                </motion.div>
              )}
            </div>
          </div>

          {/* Results with Syntax Highlighting */}
          {scanComplete && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60"
            >
              <h3 className="text-xl font-bold text-white mb-4">Code Analysis Results</h3>

              <div className="flex items-center space-x-3 mb-6">
                <div className={`p-2 rounded-lg ${
                  vulnerabilities.length > 0 ? 'bg-red-600' : 'bg-green-600'
                }`}>
                  {vulnerabilities.length > 0 ? (
                    <AlertTriangle className="h-5 w-5 text-white" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-white" />
                  )}
                </div>
                <div>
                  <p className={`text-lg font-semibold ${
                    vulnerabilities.length > 0 ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {vulnerabilities.length > 0 ? 'Vulnerabilities Detected' : 'No Vulnerabilities Found'}
                  </p>
                  <p className="text-gray-300">
                    {vulnerabilities.length > 0 
                      ? `${vulnerabilities.length} vulnerabilities found in code`
                      : 'Your code appears to be secure'
                    }
                  </p>
                </div>
              </div>

              {/* Export and Reset Buttons */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex space-x-3">
                  <button
                    onClick={() => exportReport("pdf")}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    <span>PDF</span>
                  </button>
                  <button
                    onClick={() => exportReport("json")}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all"
                  >
                    <Download className="h-4 w-4" />
                    <span>JSON</span>
                  </button>
                  <button
                    onClick={() => exportReport("csv")}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    <span>CSV</span>
                  </button>
                </div>
                <button
                  onClick={resetScan}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  New Scan
                </button>
              </div>

              {/* Code Issues with Syntax Highlighting */}
              <div className="space-y-4">
                {vulnerabilities.length === 0 ? (
                  <div className="bg-green-900/30 border border-green-700 rounded-lg p-6 text-center">
                    <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                    <h4 className="font-semibold text-green-400 mb-2">Great Job!</h4>
                    <p className="text-gray-300">No security vulnerabilities were detected in your code.</p>
                  </div>
                ) : (
                  vulnerabilities.map((vulnerability) => {
                    const severityColors = {
                      critical: 'bg-red-900/30 border-red-700',
                      high: 'bg-orange-900/30 border-orange-700',
                      medium: 'bg-yellow-900/30 border-yellow-700',
                      low: 'bg-blue-900/30 border-blue-700'
                    }
                    const severityTextColors = {
                      critical: 'text-red-400',
                      high: 'text-orange-400',
                      medium: 'text-yellow-400',
                      low: 'text-blue-400'
                    }
                    
                    return (
                      <div key={vulnerability.id} className={`${severityColors[vulnerability.severity]} rounded-lg p-4`}>
                        <h4 className={`font-semibold ${severityTextColors[vulnerability.severity]} mb-2`}>
                          {vulnerability.type} - {vulnerability.file}:{vulnerability.line}
                        </h4>
                        {vulnerability.codeSnippet && (
                          <div className="bg-gray-900 rounded p-3 mb-2 font-mono text-sm">
                            <pre className="text-white whitespace-pre-wrap">{vulnerability.codeSnippet}</pre>
                          </div>
                        )}
                        <p className="text-gray-300 text-sm mb-2">{vulnerability.description}</p>
                        {vulnerability.recommendation && (
                          <p className="text-gray-400 text-sm italic">
                            <strong>Recommendation:</strong> {vulnerability.recommendation}
                          </p>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </motion.div>
          )}
        </div>
        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60">
            <h3 className="text-lg font-bold text-white mb-4">Vulnerability Types</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                <p className="text-gray-300 text-sm">Buffer overflow detection</p>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                <p className="text-gray-300 text-sm">Memory management issues</p>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                <p className="text-gray-300 text-sm">Format string vulnerabilities</p>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                <p className="text-gray-300 text-sm">Integer overflow checks</p>
              </div>
            </div>
          </div>


