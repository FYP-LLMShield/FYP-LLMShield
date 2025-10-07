
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Shield, Upload, Link, Play, Download, MessageCircle, FileText, AlertTriangle, CheckCircle } from "lucide-react"
import { ScanningLine, RadarPulse, TerminalCursor, FloatingParticles } from "../../components/dashboard/CyberAnimations"

const PromptInjectionPage = () => {
  const [activeTab, setActiveTab] = useState("prompt")
  const [isScanning, setIsScanning] = useState(false)
  const [scanComplete, setScanComplete] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [file, setFile] = useState(null)
  const [apiEndpoint, setApiEndpoint] = useState("")
  const [scanProgress, setScanProgress] = useState(0)

  const tabs = [
    { id: "prompt", label: "Write a Prompt", icon: FileText },
    { id: "upload", label: "Upload Document", icon: Upload },
    { id: "connect", label: "Connect Model", icon: Link },
  ]

  const startScan = () => {
    setIsScanning(true)
    setScanProgress(0)

    // Simulate scan progress
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsScanning(false)
          setScanComplete(true)
          return 100
        }
        return prev + 10
      })
    }, 500)
  }

  const exportReport = (format) => {
    console.log(`Exporting report as ${format}`)
  }

  return (
    <div className="space-y-6 relative">
      <FloatingParticles count={15} />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="animate-fadeIn">
          <h1 className="text-5xl font-bold gradient-text-cyber mb-3 animate-pulse-glow flex items-center gap-4">
            <Shield className="w-12 h-12 text-blue-400 animate-float" />
            Prompt Injection Testing
          </h1>
          <p className="text-gray-300 text-lg">Advanced AI security testing with real-time threat detection</p>
        </div>
        {scanComplete && (
          <button
            onClick={() => {
              setIsScanning(false)
              setScanComplete(false)
              setScanProgress(0)
              setPrompt("")
              setFile(null)
              setApiEndpoint("")
            }}
            className="border-blue-500/30 text-blue-400 hover:bg-blue-500/20 bg-transparent hover-lift animate-glow px-4 py-2 rounded-lg border transition-all duration-300"
          >
            <Play className="mr-2 h-4 w-4" />
            New Test
          </button>
        )}
      </div>

      {!isScanning && !scanComplete && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
          {/* Input Method Selection */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/5 backdrop-blur-md border border-purple-500/20 shadow-2xl shadow-purple-500/10 hover:shadow-purple-500/20 transition-all duration-300 hover-lift rounded-lg p-6">
              <div className="text-white text-2xl flex items-center gap-3 mb-6">
                <MessageCircle className="w-6 h-6 text-purple-400 animate-pulse" />
                Input Method Selection
              </div>
              
              {/* Tab Navigation */}
              <div className="flex space-x-1 bg-slate-800/50 p-1 rounded-lg backdrop-blur-sm mb-6">
                {tabs.map((tab) => {
                  const IconComponent = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                        activeTab === tab.id
                          ? "bg-purple-600 text-white shadow-lg"
                          : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                      }`}
                    >
                      <IconComponent className="w-4 h-4 mr-2" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>

            <div className="p-6">
              <AnimatePresence mode="wait">
                {activeTab === "prompt" && (
                  <motion.div
                    key="prompt"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <label className="block text-white font-medium mb-2">Enter your prompt:</label>
                    <motion.textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Type your prompt here to test for injection vulnerabilities..."
                      className="w-full h-40 bg-gradient-to-r from-purple-800/80 to-pink-800/60 border border-purple-600/70 rounded-lg p-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all duration-300"
                      whileFocus={{ scale: 1.01, borderColor: "#ef4444" }}
                    />
                  </motion.div>
                )}

                {activeTab === "upload" && (
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <label className="block text-white font-medium mb-2">Upload Document:</label>
                    <motion.div
                      className="border-2 border-dashed border-purple-700 rounded-lg p-8 text-center relative overflow-hidden"
                      whileHover={{ borderColor: "#3b82f6", scale: 1.01 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-300 mb-2">Drop your file here or click to browse</p>
                      <p className="text-gray-500 text-sm">Supports PDF, TXT, DOCX files</p>
                      <input
                        type="file"
                        onChange={(e) => setFile(e.target.files[0])}
                        className="hidden"
                        accept=".pdf,.txt,.docx"
                      />
                    </motion.div>
                    {file && (
                      <motion.div
                        className="bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-lg p-3 flex items-center space-x-3"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <FileText className="h-5 w-5 text-purple-400" />
                        <span className="text-white">{file.name}</span>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {activeTab === "connect" && (
                  <motion.div
                    key="connect"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <label className="block text-white font-medium mb-2">API Endpoint:</label>
                    <input
                      type="url"
                      value={apiEndpoint}
                      onChange={(e) => setApiEndpoint(e.target.value)}
                      placeholder="https://api.example.com/v1/chat/completions"
                      className="w-full bg-gradient-to-r from-purple-800/80 to-pink-800/60 border border-purple-700 rounded-lg p-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white font-medium mb-2">API Key:</label>
                        <input
                          type="password"
                          placeholder="sk-..."
                          className="w-full bg-gradient-to-r from-purple-800/80 to-pink-800/60 border border-purple-700 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-white font-medium mb-2">Model:</label>
                        <input
                          type="text"
                          placeholder="gpt-4"
                          className="w-full bg-gradient-to-r from-purple-800/80 to-pink-800/60 border border-purple-700 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Scan Button */}
              <motion.button
                onClick={startScan}
                disabled={isScanning}
                className="w-full mt-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2 relative overflow-hidden"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                animate={
                  isScanning
                    ? {
                        boxShadow: [
                          "0 0 0 0 rgba(239, 68, 68, 0.7)",
                          "0 0 0 10px rgba(239, 68, 68, 0)",
                          "0 0 0 0 rgba(239, 68, 68, 0)",
                        ],
                      }
                    : {}
                }
                transition={{ duration: 2, repeat: isScanning ? Number.POSITIVE_INFINITY : 0 }}
              >
                {isScanning && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                  />
                )}
                <Play className="h-5 w-5" />
                <span>{isScanning ? "Scanning..." : "Start Scan"}</span>
              </motion.button>

              {/* Progress Bar */}
              {isScanning && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
                  <div className="bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-full h-2 overflow-hidden relative">
                    <motion.div
                      className="h-full bg-red-500 relative"
                      initial={{ width: 0 }}
                      animate={{ width: `${scanProgress}%` }}
                      transition={{ duration: 0.5 }}
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                      />
                    </motion.div>
                  </div>
                  <p className="text-center text-gray-300 mt-2">{scanProgress}% Complete</p>
                </motion.div>
              )}
            </div>
            </div>
          </div>

          {/* Results */}
          {scanComplete && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60 relative overflow-hidden"
            >
              <div className="absolute top-4 right-4">
                <RadarPulse size="w-8 h-8" color="red" />
              </div>

              <h3 className="text-xl font-bold text-white mb-4">Scan Results</h3>

              {/* Risk Level */}
              <motion.div
                className="flex items-center space-x-3 mb-6"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="p-2 bg-red-600 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-red-400">High Risk Detected</p>
                  <p className="text-gray-300">3 potential injection vulnerabilities found</p>
                </div>
              </motion.div>

              {/* Export Buttons */}
              <div className="flex space-x-3 mb-6">
                {["PDF", "JSON", "CSV"].map((format, index) => (
                  <motion.button
                    key={format}
                    onClick={() => exportReport(format.toLowerCase())}
                    className={`${format === "PDF" || format === "CSV" ? "bg-green-600 hover:bg-green-700" : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"} text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Download className="h-4 w-4" />
                    <span>{format}</span>
                  </motion.button>
                ))}
              </div>

              {/* Detailed Results */}
              <div className="space-y-4">
                {[
                  {
                    title: "SQL Injection Attempt",
                    desc: "Detected potential SQL injection pattern in user input",
                    severity: "red",
                  },
                  { title: "Command Injection", desc: "Found suspicious command execution patterns", severity: "red" },
                  {
                    title: "Prompt Manipulation",
                    desc: "Identified attempts to manipulate model behavior",
                    severity: "yellow",
                  },
                ].map((result, index) => (
                  <motion.div
                    key={result.title}
                    className={`bg-${result.severity}-900/30 border border-${result.severity}-700 rounded-lg p-4`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    whileHover={{
                      scale: 1.02,
                      borderColor: `rgb(${result.severity === "red" ? "239 68 68" : "234 179 8"})`,
                    }}
                  >
                    <h4 className={`font-semibold text-${result.severity}-400 mb-2`}>{result.title}</h4>
                    <p className="text-gray-300 text-sm">{result.desc}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">

        <div className="space-y-6">
          {/* Mitigation Steps */}
          <motion.div
            className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            whileHover={{ borderColor: "#22c55e" }}
          >
            <h3 className="text-lg font-bold text-white mb-4">Mitigation Steps</h3>
            <div className="space-y-3">
              {[
                "Implement input validation and sanitization",
                "Use parameterized queries for database operations",
                "Apply rate limiting and monitoring",
              ].map((step, index) => (
                <motion.div
                  key={step}
                  className="flex items-start space-x-3"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                >
                  <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                  <p className="text-gray-300 text-sm">{step}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Chatbot Assistant */}
          <motion.div
            className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            whileHover={{ borderColor: "#3b82f6" }}
          >
            <h3 className="text-lg font-bold text-white mb-4">AI Assistant</h3>
            <div className="bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-lg p-4 mb-4 relative">
              <p className="text-gray-300 text-sm">
                Hi! I can help you understand the scan results and provide guidance on fixing vulnerabilities. What
                would you like to know?
              </p>
              <motion.div
                className="absolute bottom-2 right-2 flex space-x-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1 h-1 bg-purple-400 rounded-full"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      duration: 1.5,
                      repeat: Number.POSITIVE_INFINITY,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </motion.div>
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Ask about the results..."
                className="flex-1 bg-gradient-to-r from-purple-700/80 to-pink-700/60 border border-purple-500/70 rounded-lg p-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <motion.button
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white p-2 rounded-lg transition-all"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <MessageCircle className="h-4 w-4" />
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default PromptInjectionPage