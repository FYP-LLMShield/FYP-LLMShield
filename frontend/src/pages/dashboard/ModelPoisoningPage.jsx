
import { useState } from "react"
import { motion } from "framer-motion"
import { Lock, Upload, Play, Download, MessageCircle, AlertTriangle, CheckCircle, FileText } from "lucide-react"

const ModelPoisoningPage = () => {
  const [isScanning, setIsScanning] = useState(false)
  const [scanComplete, setScanComplete] = useState(false)
  const [file, setFile] = useState(null)
  const [scanProgress, setScanProgress] = useState(0)

  const startScan = () => {
    setIsScanning(true)
    setScanProgress(0)

    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsScanning(false)
          setScanComplete(true)
          return 100
        }
        return prev + 8
      })
    }, 600)
  }

  const exportReport = (format) => {
    console.log(`Exporting report as ${format}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-red-900 via-purple-900 to-pink-900 p-8 rounded-lg border border-red-800"
      >
        <div className="flex items-center space-x-3 mb-4">
          <div className="bg-gradient-to-br from-red-500 via-purple-600 to-pink-600 p-3 rounded-lg">
            <Lock className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Model Poisoning Scanner</h1>
            <p className="text-gray-300">Detect data poisoning attacks and compromised model training</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Scanner */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gradient-to-r from-red-800 via-purple-800 to-pink-800 p-6 rounded-lg border border-red-700">
            <h3 className="text-lg font-bold text-white mb-4">Upload/Connect Model</h3>

            {/* File Upload */}
            <div className="space-y-4">
              <div className="border-2 border-dashed border-purple-700 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-300 mb-2">Upload your model file or training data</p>
                <p className="text-gray-500 text-sm">Supports .pkl, .h5, .pt, .safetensors, .json files</p>
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="hidden"
                  accept=".pkl,.h5,.pt,.safetensors,.json"
                />
              </div>

              {file && (
                <div className="bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-lg p-3 flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-purple-400" />
                  <span className="text-white">{file.name}</span>
                </div>
              )}

              {/* Model Connection */}
              <div className="border-t border-purple-800 pt-4">
                <h4 className="text-white font-medium mb-3">Or Connect to Model API</h4>
                <div className="grid grid-cols-1 gap-4">
                  <input
                    type="url"
                    placeholder="Model API Endpoint"
                    className="w-full bg-gradient-to-r from-purple-800/80 to-pink-800/60 border border-purple-700/60 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <input
                    type="password"
                    placeholder="API Key"
                    className="w-full bg-gradient-to-r from-purple-800/80 to-pink-800/60 border border-purple-700 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Scan Button */}
              <motion.button
                onClick={startScan}
                disabled={isScanning}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Play className="h-5 w-5" />
                <span>{isScanning ? "Analyzing Model..." : "Start Analysis"}</span>
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
                  <p className="text-center text-gray-300 mt-2">Analyzing... {scanProgress}%</p>
                </motion.div>
              )}
            </div>
          </div>

          {/* Results */}
          {scanComplete && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60"
            >
              <h3 className="text-xl font-bold text-white mb-4">Analysis Results</h3>

              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-yellow-600 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-yellow-400">Medium Risk Detected</p>
                  <p className="text-gray-300">Potential data poisoning indicators found</p>
                </div>
              </div>

              {/* Export Buttons */}
              <div className="flex space-x-3 mb-6">
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

              <div className="space-y-4">
                <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-400 mb-2">Anomalous Training Patterns</h4>
                  <p className="text-gray-300 text-sm">Detected unusual patterns in training data distribution</p>
                </div>
                <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
                  <h4 className="font-semibold text-green-400 mb-2">Model Integrity Check</h4>
                  <p className="text-gray-300 text-sm">Model weights and architecture appear consistent</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-purple-900 to-pink-900 p-6 rounded-lg border border-purple-800">
            <h3 className="text-lg font-bold text-white mb-4">Detection Methods</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                <p className="text-gray-300 text-sm">Statistical analysis of training data</p>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                <p className="text-gray-300 text-sm">Model behavior consistency checks</p>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                <p className="text-gray-300 text-sm">Backdoor trigger detection</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-600 to-pink-600 p-3 rounded-lg">
            <h3 className="text-lg font-bold text-white mb-4">AI Assistant</h3>
            <div className="bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-lg p-4 mb-4">
              <p className="text-gray-300 text-sm">
                I can help explain the poisoning detection results and suggest remediation strategies. What would you
                like to know?
              </p>
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Ask about model security..."
                className="flex-1 bg-gradient-to-r from-purple-700/80 to-pink-700/60 border border-purple-500/70 rounded-lg p-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white p-2 rounded-lg transition-all">
                <MessageCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ModelPoisoningPage