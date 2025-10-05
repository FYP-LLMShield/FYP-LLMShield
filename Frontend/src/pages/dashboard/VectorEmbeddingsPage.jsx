
import { useState } from "react"
import { motion } from "framer-motion"
import { Eye, Upload, Play, Download, MessageCircle, CheckCircle, FileText } from "lucide-react"

const VectorEmbeddingsPage = () => {
  const [isScanning, setIsScanning] = useState(false)
  const [scanComplete, setScanComplete] = useState(false)
  const [files, setFiles] = useState([])
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
        return prev + 12
      })
    }, 400)
  }

  const exportReport = (format) => {
    console.log(`Exporting report as ${format}`)
  }

  const handleFileUpload = (e) => {
    const newFiles = Array.from(e.target.files)
    setFiles((prev) => [...prev, ...newFiles])
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
          <div className="p-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg">
            <Eye className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Vector & Embedding Weaknesses</h1>
            <p className="text-gray-300">Analyze RAG systems for compromised vector embeddings and vulnerabilities</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Scanner */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60">
            <h3 className="text-lg font-bold text-white mb-4">Upload Test Documents</h3>

            <div className="space-y-4">
              <div className="border-2 border-dashed border-purple-700 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-300 mb-2">Upload documents for vector analysis</p>
                <p className="text-gray-500 text-sm">Supports PDF, TXT, DOCX, MD files</p>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".pdf,.txt,.docx,.md"
                />
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-white font-medium">Uploaded Files:</h4>
                  {files.map((file, index) => (
                    <div key={index} className="bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-lg p-3 flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-purple-400" />
                      <span className="text-white">{file.name}</span>
                      <span className="text-gray-400 text-sm ml-auto">{(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Configuration */}
              <div className="border-t border-purple-800 pt-4">
                <h4 className="text-white font-medium mb-3">Analysis Configuration</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 text-sm mb-2">Similarity Threshold</label>
                    <input type="range" min="0.1" max="1.0" step="0.1" defaultValue="0.8" className="w-full" />
                  </div>
                  <div>
                    <label className="block text-gray-300 text-sm mb-2">Vector Dimensions</label>
                    <select className="w-full bg-gradient-to-r from-purple-800/80 to-pink-800/60 border border-purple-700 rounded-lg p-2 text-white">
                      <option>384</option>
                      <option>768</option>
                      <option>1536</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Scan Button */}
              <motion.button
                onClick={startScan}
                disabled={isScanning || files.length === 0}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center space-x-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Play className="h-5 w-5" />
                <span>{isScanning ? "Analyzing Vectors..." : "Start Vector Analysis"}</span>
              </motion.button>

              {/* Progress Bar */}
              {isScanning && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
                  <div className="bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${scanProgress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <p className="text-center text-gray-300 mt-2">Processing embeddings... {scanProgress}%</p>
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
              <h3 className="text-xl font-bold text-white mb-4">Vector Analysis Results</h3>

              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-green-600 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-green-400">Low Risk Detected</p>
                  <p className="text-gray-300">Vector embeddings appear secure with minor issues</p>
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
                <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
                  <h4 className="font-semibold text-green-400 mb-2">Vector Integrity</h4>
                  <p className="text-gray-300 text-sm">No suspicious vectors or high-similarity collisions detected</p>
                </div>
                <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-400 mb-2">Embedding Diversity</h4>
                  <p className="text-gray-300 text-sm">Some clusters show low diversity - consider data augmentation</p>
                </div>
                <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
                  <h4 className="font-semibold text-green-400 mb-2">Adversarial Resistance</h4>
                  <p className="text-gray-300 text-sm">Embeddings show good resistance to adversarial queries</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60">
            <h3 className="text-lg font-bold text-white mb-4">Analysis Focus</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-purple-400 mt-0.5" />
                <p className="text-gray-300 text-sm">Suspicious vectors detection</p>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-purple-400 mt-0.5" />
                <p className="text-gray-300 text-sm">High-similarity collisions</p>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-purple-400 mt-0.5" />
                <p className="text-gray-300 text-sm">Injection-like entries</p>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-purple-400 mt-0.5" />
                <p className="text-gray-300 text-sm">Adversarial queries</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60">
            <h3 className="text-lg font-bold text-white mb-4">AI Assistant</h3>
            <div className="bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-lg p-4 mb-4">
              <p className="text-gray-300 text-sm">
                I can help you understand vector embedding vulnerabilities and suggest improvements for your RAG system.
                What would you like to know?
              </p>
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Ask about embeddings..."
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

export default VectorEmbeddingsPage
