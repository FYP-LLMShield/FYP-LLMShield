
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, FileText, Code, Key, Globe, Server, Brain } from "lucide-react"

const ModelConfigModal = ({ isOpen, onClose, onComplete, initialConfig, scanType }) => {
  const [step, setStep] = useState(1)
  const [config, setConfig] = useState({
    type: "",
    name: "",
    apiKey: "",
    endpoint: "",
    documents: [],
    codeFiles: [],
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig)
    }
  }, [initialConfig])

  const modelTypes = [
    {
      id: "openai",
      name: "OpenAI",
      description: "GPT-3.5, GPT-4, and other OpenAI models",
      icon: Brain,
      requiresApiKey: true,
    },
    {
      id: "huggingface",
      name: "Hugging Face",
      description: "Open-source models from Hugging Face Hub",
      icon: Globe,
      requiresApiKey: true,
    },
    {
      id: "local",
      name: "Local Model",
      description: "Self-hosted or local AI models",
      icon: Server,
      requiresApiKey: false,
    },
  ]

  const handleTypeSelect = (type) => {
    setConfig((prev) => ({ ...prev, type }))
    setStep(2)
  }

  const handleInputChange = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const handleFileUpload = (field, files) => {
    setConfig((prev) => ({ ...prev, [field]: Array.from(files) }))
  }

  const validateConfig = () => {
    const newErrors = {}
    if (!config.name) newErrors.name = "Model name is required"
    if (config.type !== "local" && !config.apiKey) newErrors.apiKey = "API key is required"
    if (config.type === "local" && !config.endpoint) newErrors.endpoint = "Endpoint URL is required"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleComplete = () => {
    if (validateConfig()) {
      onComplete(config)
    }
  }

  const selectedModelType = modelTypes.find((type) => type.id === config.type)

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-2xl bg-cyber-gray-800 border border-cyber-gray-600 rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-cyber-gray-600">
              <div>
                <h2 className="text-2xl font-cyber font-bold text-white">Model Configuration</h2>
                <p className="text-gray-400 mt-1">
                  {scanType ? `Configure your model for ${scanType} scanning` : "Set up your AI model"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-cyber-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Progress Indicator */}
            <div className="px-6 py-4 border-b border-cyber-gray-600">
              <div className="flex items-center space-x-4">
                <div className={`flex items-center space-x-2 ${step >= 1 ? "text-cyber-green" : "text-gray-400"}`}>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? "bg-cyber-green text-black" : "bg-cyber-gray-700"}`}
                  >
                    1
                  </div>
                  <span className="text-sm font-medium">Model Type</span>
                </div>
                <div className={`w-8 h-0.5 ${step >= 2 ? "bg-cyber-green" : "bg-cyber-gray-600"}`} />
                <div className={`flex items-center space-x-2 ${step >= 2 ? "text-cyber-green" : "text-gray-400"}`}>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? "bg-cyber-green text-black" : "bg-cyber-gray-700"}`}
                  >
                    2
                  </div>
                  <span className="text-sm font-medium">Configuration</span>
                </div>
                <div className={`w-8 h-0.5 ${step >= 3 ? "bg-cyber-green" : "bg-cyber-gray-600"}`} />
                <div className={`flex items-center space-x-2 ${step >= 3 ? "text-cyber-green" : "text-gray-400"}`}>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 3 ? "bg-cyber-green text-black" : "bg-cyber-gray-700"}`}
                  >
                    3
                  </div>
                  <span className="text-sm font-medium">Optional Files</span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {step === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <h3 className="text-lg font-semibold text-white mb-4">Select Model Type</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {modelTypes.map((type) => {
                      const IconComponent = type.icon
                      return (
                        <motion.button
                          key={type.id}
                          onClick={() => handleTypeSelect(type.id)}
                          className={`p-4 border rounded-lg text-left transition-all duration-300 hover:scale-105 ${
                            config.type === type.id
                              ? "border-cyber-green bg-cyber-green/10"
                              : "border-cyber-gray-600 hover:border-cyber-green/50"
                          }`}
                          whileHover={{ y: -2 }}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-cyber-green/20 rounded-lg">
                              <IconComponent className="h-6 w-6 text-cyber-green" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-white">{type.name}</h4>
                              <p className="text-sm text-gray-400">{type.description}</p>
                            </div>
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                </motion.div>
              )}

              {step === 2 && selectedModelType && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="flex items-center space-x-3 mb-4">
                    <selectedModelType.icon className="h-6 w-6 text-cyber-green" />
                    <h3 className="text-lg font-semibold text-white">Configure {selectedModelType.name}</h3>
                  </div>

                  {/* Model Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Model Name</label>
                    <input
                      type="text"
                      value={config.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      className={`cyber-input ${errors.name ? "border-red-500" : ""}`}
                      placeholder={
                        config.type === "openai"
                          ? "gpt-4, gpt-3.5-turbo"
                          : config.type === "huggingface"
                            ? "microsoft/DialoGPT-medium"
                            : "my-local-model"
                      }
                    />
                    {errors.name && <p className="mt-1 text-sm text-red-400">{errors.name}</p>}
                  </div>

                  {/* API Key or Endpoint */}
                  {selectedModelType.requiresApiKey ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">API Key</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Key className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="password"
                          value={config.apiKey}
                          onChange={(e) => handleInputChange("apiKey", e.target.value)}
                          className={`cyber-input pl-10 ${errors.apiKey ? "border-red-500" : ""}`}
                          placeholder="Enter your API key"
                        />
                      </div>
                      {errors.apiKey && <p className="mt-1 text-sm text-red-400">{errors.apiKey}</p>}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Endpoint URL</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Globe className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="url"
                          value={config.endpoint}
                          onChange={(e) => handleInputChange("endpoint", e.target.value)}
                          className={`cyber-input pl-10 ${errors.endpoint ? "border-red-500" : ""}`}
                          placeholder="http://localhost:8000/api/v1"
                        />
                      </div>
                      {errors.endpoint && <p className="mt-1 text-sm text-red-400">{errors.endpoint}</p>}
                    </div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex justify-between pt-4">
                    <button
                      onClick={() => setStep(1)}
                      className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                      Back
                    </button>
                    <div className="space-x-3">
                      <button onClick={() => setStep(3)} className="cyber-button-blue">
                        Next: Optional Files
                      </button>
                      <button onClick={handleComplete} className="cyber-button">
                        Complete Setup
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <h3 className="text-lg font-semibold text-white mb-4">Optional File Uploads</h3>

                  {/* Document Upload for Prompt Injection */}
                  <div className="cyber-card">
                    <div className="flex items-center space-x-3 mb-3">
                      <FileText className="h-5 w-5 text-cyber-green" />
                      <h4 className="font-medium text-white">Documents for Prompt Injection Testing</h4>
                    </div>
                    <p className="text-sm text-gray-400 mb-3">
                      Upload PDF or TXT files to test prompt injection vulnerabilities
                    </p>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.txt"
                      onChange={(e) => handleFileUpload("documents", e.target.files)}
                      className="cyber-input"
                    />
                    {config.documents.length > 0 && (
                      <div className="mt-2 text-sm text-cyber-green">{config.documents.length} file(s) selected</div>
                    )}
                  </div>

                  {/* Code Upload for C/C++ Scanning */}
                  <div className="cyber-card">
                    <div className="flex items-center space-x-3 mb-3">
                      <Code className="h-5 w-5 text-cyber-blue" />
                      <h4 className="font-medium text-white">C/C++ Code Files</h4>
                    </div>
                    <p className="text-sm text-gray-400 mb-3">Upload C/C++ source files for security analysis</p>
                    <input
                      type="file"
                      multiple
                      accept=".c,.cpp,.cc,.cxx,.h,.hpp"
                      onChange={(e) => handleFileUpload("codeFiles", e.target.files)}
                      className="cyber-input"
                    />
                    {config.codeFiles.length > 0 && (
                      <div className="mt-2 text-sm text-cyber-blue">{config.codeFiles.length} file(s) selected</div>
                    )}
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex justify-between pt-4">
                    <button
                      onClick={() => setStep(2)}
                      className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                    >
                      Back
                    </button>
                    <button onClick={handleComplete} className="cyber-button">
                      Complete Setup
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default ModelConfigModal