import React, { useState } from "react"
import { promptInjectionAPI, VectorStoreAnalysisResponse, AnomalyFinding } from "../../lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Switch } from "../ui/switch"
import { Label } from "../ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { AlertTriangle, Database, Loader2, CheckCircle, XCircle, TrendingUp, Info, Users, Box, Search, Trash2, ShieldAlert, Settings, BarChart, LayoutGrid, Download, FileDown, Lock, RefreshCw, Cloud, Upload, Link2, Eye, EyeOff } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "../ui/dialog"
import { Progress } from "../ui/progress"

type SourceType = 'json_upload' | 'pinecone' | 'pinecone_env'

export const VectorStoreAnalysisPage: React.FC = () => {
  // Source selection
  const [sourceType, setSourceType] = useState<SourceType>('json_upload')
  
  // JSON upload state
  const [file, setFile] = useState<File | null>(null)
  
  // Pinecone credentials
  const [pineconeApiKey, setPineconeApiKey] = useState<string>('')
  const [pineconeIndexName, setPineconeIndexName] = useState<string>('')
  const [pineconeEnvironment, setPineconeEnvironment] = useState<string>('')
  const [pineconeNamespace, setPineconeNamespace] = useState<string>('')
  const [showApiKey, setShowApiKey] = useState(false)
  
  // Connection test state
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<{success: boolean; message: string; totalVectors?: number} | null>(null)
  
  // Analysis parameters
  const [sampleSize, setSampleSize] = useState<number | undefined>(undefined)
  const [collisionThreshold, setCollisionThreshold] = useState<number>(0.95)
  const [batchSize, setBatchSize] = useState<number>(1000)
  const [enableClustering, setEnableClustering] = useState<boolean>(true)
  const [enableCollision, setEnableCollision] = useState<boolean>(true)
  const [enableOutlier, setEnableOutlier] = useState<boolean>(true)
  const [enableTrigger, setEnableTrigger] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState("config")
  const [result, setResult] = useState<VectorStoreAnalysisResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [selectedForQuarantine, setSelectedForQuarantine] = useState<Set<string>>(new Set())

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError(null)
    }
  }

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 B"
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
  }

  const confidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) return <Badge className="bg-red-600 text-white">Critical</Badge>
    if (confidence >= 0.7) return <Badge className="bg-orange-500 text-white">High</Badge>
    if (confidence >= 0.5) return <Badge className="bg-amber-500 text-white">Medium</Badge>
    return <Badge className="bg-emerald-600 text-white">Low</Badge>
  }

  const categoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      dense_cluster_poisoning: "bg-purple-600",
      high_similarity_collision: "bg-blue-600",
      extreme_norm_outlier: "bg-red-600",
      isolation_forest_outlier: "bg-pink-600",
      trigger_pattern_detected: "bg-orange-600",
    }
    return (
      <Badge className={colors[category] || "bg-gray-600"} variant="outline">
        {category.replace(/_/g, " ").replace(/detected|poisoning|outlier/g, "").trim()}
      </Badge>
    )
  }

  const [selectedFinding, setSelectedFinding] = useState<AnomalyFinding | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const openFindingDetails = (finding: AnomalyFinding) => {
    setSelectedFinding(finding)
    setIsDetailsOpen(true)
  }

  const handleTestConnection = async () => {
    if (sourceType !== 'pinecone' && sourceType !== 'pinecone_env') return
    
    setIsTestingConnection(true)
    setConnectionStatus(null)
    setError(null)
    
    try {
      const response = await promptInjectionAPI.testVectorDBConnection({
        source_type: sourceType,
        pinecone_api_key: sourceType === 'pinecone' ? pineconeApiKey : undefined,
        pinecone_index_name: sourceType === 'pinecone' ? pineconeIndexName : undefined,
        pinecone_environment: sourceType === 'pinecone' ? pineconeEnvironment : undefined,
        pinecone_namespace: pineconeNamespace || undefined,
      })
      
      if (response.success && response.data) {
        setConnectionStatus({
          success: response.data.success,
          message: response.data.message,
          totalVectors: response.data.total_vectors
        })
      } else {
        setConnectionStatus({
          success: false,
          message: response.error || "Connection test failed"
        })
      }
    } catch (e: any) {
      setConnectionStatus({
        success: false,
        message: e.message || "Connection test failed"
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  const handleAnalyze = async () => {
    // Validation based on source type
    if (sourceType === 'json_upload' && !file) {
      setError("Please select a JSON file with vector store snapshot.")
      return
    }
    if (sourceType === 'pinecone' && (!pineconeApiKey || !pineconeIndexName)) {
      setError("Pinecone API key and index name are required.")
      return
    }
    
    setIsLoading(true)
    setError(null)
    setResult(null)
    
    try {
      const response = await promptInjectionAPI.vectorStoreAnalysisMultiSource({
        source_type: sourceType,
        file: sourceType === 'json_upload' ? file || undefined : undefined,
        pinecone_api_key: sourceType === 'pinecone' ? pineconeApiKey : undefined,
        pinecone_index_name: sourceType === 'pinecone' ? pineconeIndexName : undefined,
        pinecone_environment: sourceType === 'pinecone' ? pineconeEnvironment : undefined,
        pinecone_namespace: pineconeNamespace || undefined,
        sample_size: sampleSize,
        batch_size: batchSize,
        enable_clustering: enableClustering,
        enable_collision_detection: enableCollision,
        enable_outlier_detection: enableOutlier,
        enable_trigger_detection: enableTrigger,
        collision_threshold: collisionThreshold,
      })
      if (response.success && response.data) {
        setResult(response.data as VectorStoreAnalysisResponse)
        setActiveTab("results")
      } else {
        setError(response.error || "Analysis failed.")
      }
    } catch (e: any) {
      setError(e?.message || "Analysis failed.")
    } finally {
      setIsLoading(false)
    }
  }

  const topFindings = (findings: AnomalyFinding[]) =>
    [...findings].sort((a, b) => b.confidence - a.confidence).slice(0, 50)
  
  const handleExportReport = async (format: 'pdf' | 'json' = 'pdf') => {
    if (!result) return
    setIsExporting(true)
    try {
      // Export anomaly report
      const reportData = {
        ...result,
        export_timestamp: new Date().toISOString(),
        quarantined_ids: Array.from(selectedForQuarantine)
      }
      
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `vector_anomaly_report_${result.scan_id}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        // TODO: Implement PDF export via backend endpoint
        setError("PDF export coming soon. Use JSON for now.")
      }
    } catch (e: any) {
      setError(e?.message || "Export failed")
    } finally {
      setIsExporting(false)
    }
  }
  
  const toggleQuarantine = (findingId: string) => {
    setSelectedForQuarantine(prev => {
      const next = new Set(prev)
      if (next.has(findingId)) {
        next.delete(findingId)
      } else {
        next.add(findingId)
      }
      return next
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Database className="w-6 h-6 text-blue-500" />
        <div>
          <h1 className="text-2xl font-bold text-white">Vector Store Anomaly Detection</h1>
          <p className="text-gray-400 text-sm">
            Analyze vector store snapshots for suspicious vectors, collisions, and poisoning attacks.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-900/50 border border-slate-700/50 p-1 mb-6">
          <TabsTrigger value="config" className="data-[state=active]:bg-blue-600">
            <Settings className="w-4 h-4 mr-2" /> Configuration
          </TabsTrigger>
          <TabsTrigger value="results" disabled={!result && !isLoading} className="data-[state=active]:bg-blue-600">
            <BarChart className="w-4 h-4 mr-2" /> Analysis Results
          </TabsTrigger>
          <TabsTrigger value="findings" disabled={!result || result.findings.length === 0} className="data-[state=active]:bg-blue-600">
            <LayoutGrid className="w-4 h-4 mr-2" /> Detailed Findings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
          {/* Source Selection Card */}
          <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-400" />
                Vector Store Source
              </CardTitle>
              <CardDescription className="text-gray-400">
                Choose how to connect to your vector database
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Source Type Selector */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* JSON Upload Option */}
                <div 
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    sourceType === 'json_upload' 
                      ? 'border-blue-500 bg-blue-500/10' 
                      : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                  }`}
                  onClick={() => {
                    setSourceType('json_upload')
                    setConnectionStatus(null)
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      sourceType === 'json_upload' ? 'bg-blue-500/20' : 'bg-slate-700/50'
                    }`}>
                      <Upload className={`w-5 h-5 ${sourceType === 'json_upload' ? 'text-blue-400' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <div className="text-white font-medium">Upload JSON</div>
                      <div className="text-xs text-gray-500">Local file</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">Upload a JSON snapshot of your vector store</p>
                </div>

                {/* Pinecone Option */}
                <div 
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    sourceType === 'pinecone' 
                      ? 'border-green-500 bg-green-500/10' 
                      : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                  }`}
                  onClick={() => {
                    setSourceType('pinecone')
                    setConnectionStatus(null)
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      sourceType === 'pinecone' ? 'bg-green-500/20' : 'bg-slate-700/50'
                    }`}>
                      <Cloud className={`w-5 h-5 ${sourceType === 'pinecone' ? 'text-green-400' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <div className="text-white font-medium">Pinecone</div>
                      <div className="text-xs text-gray-500">Cloud DB</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">Connect directly to your Pinecone index</p>
                </div>

                {/* Pinecone from Env Option */}
                <div 
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    sourceType === 'pinecone_env' 
                      ? 'border-purple-500 bg-purple-500/10' 
                      : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                  }`}
                  onClick={() => {
                    setSourceType('pinecone_env')
                    setConnectionStatus(null)
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      sourceType === 'pinecone_env' ? 'bg-purple-500/20' : 'bg-slate-700/50'
                    }`}>
                      <Link2 className={`w-5 h-5 ${sourceType === 'pinecone_env' ? 'text-purple-400' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <div className="text-white font-medium">Pinecone (Env)</div>
                      <div className="text-xs text-gray-500">Pre-configured</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">Use credentials from .env file</p>
                </div>
              </div>

              {/* JSON Upload Form */}
              {sourceType === 'json_upload' && (
                <div className="p-6 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/20 hover:bg-slate-800/30 transition-all">
                  <Input
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="hidden"
                    id="snapshot-upload"
                  />
                  <label htmlFor="snapshot-upload" className="cursor-pointer block text-center">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                      <Database className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="text-white font-medium mb-1">{file ? file.name : "Select Vector Snapshot"}</div>
                    <div className="text-xs text-gray-400">JSON files containing embeddings and metadata</div>
                  </label>
                </div>
              )}

              {/* Pinecone Credentials Form */}
              {sourceType === 'pinecone' && (
                <div className="space-y-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300">API Key *</Label>
                      <div className="relative">
                        <Input
                          type={showApiKey ? "text" : "password"}
                          value={pineconeApiKey}
                          onChange={(e) => setPineconeApiKey(e.target.value)}
                          placeholder="pcsk_xxxxx..."
                          className="bg-slate-800/50 border-slate-700 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Index Name *</Label>
                      <Input
                        type="text"
                        value={pineconeIndexName}
                        onChange={(e) => setPineconeIndexName(e.target.value)}
                        placeholder="llmshield-demo"
                        className="bg-slate-800/50 border-slate-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Environment (optional)</Label>
                      <Input
                        type="text"
                        value={pineconeEnvironment}
                        onChange={(e) => setPineconeEnvironment(e.target.value)}
                        placeholder="us-east-1-aws"
                        className="bg-slate-800/50 border-slate-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">Namespace (optional)</Label>
                      <Input
                        type="text"
                        value={pineconeNamespace}
                        onChange={(e) => setPineconeNamespace(e.target.value)}
                        placeholder="default"
                        className="bg-slate-800/50 border-slate-700"
                      />
                    </div>
                  </div>
                  
                  {/* Test Connection Button */}
                  <div className="flex items-center gap-4 pt-2">
                    <Button
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={isTestingConnection || !pineconeApiKey || !pineconeIndexName}
                      className="border-green-600 text-green-400 hover:bg-green-600/20"
                    >
                      {isTestingConnection ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testing...</>
                      ) : (
                        <><Link2 className="w-4 h-4 mr-2" /> Test Connection</>
                      )}
                    </Button>
                    
                    {connectionStatus && (
                      <div className={`flex items-center gap-2 text-sm ${connectionStatus.success ? 'text-green-400' : 'text-red-400'}`}>
                        {connectionStatus.success ? (
                          <><CheckCircle className="w-4 h-4" /> {connectionStatus.message} ({connectionStatus.totalVectors} vectors)</>
                        ) : (
                          <><XCircle className="w-4 h-4" /> {connectionStatus.message}</>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pinecone from Env */}
              {sourceType === 'pinecone_env' && (
                <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-300 mb-2">
                        Using Pinecone credentials from environment variables:
                      </p>
                      <code className="text-xs text-purple-300 bg-purple-900/30 px-2 py-1 rounded">
                        PINECONE_API_KEY, PINECONE_INDEX_NAME, PINECONE_ENVIRONMENT
                      </code>
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleTestConnection}
                          disabled={isTestingConnection}
                          className="border-purple-600 text-purple-400 hover:bg-purple-600/20"
                        >
                          {isTestingConnection ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testing...</>
                          ) : (
                            <><Link2 className="w-4 h-4 mr-2" /> Test Connection</>
                          )}
                        </Button>
                        
                        {connectionStatus && (
                          <span className={`ml-3 text-sm ${connectionStatus.success ? 'text-green-400' : 'text-red-400'}`}>
                            {connectionStatus.success ? (
                              <><CheckCircle className="w-4 h-4 inline mr-1" /> {connectionStatus.totalVectors} vectors</>
                            ) : (
                              <><XCircle className="w-4 h-4 inline mr-1" /> {connectionStatus.message}</>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-slate-900/40 border-slate-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-400" />
                  Analysis Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Sample Size</Label>
                    <Input
                      type="number"
                      min={100}
                      value={sampleSize || ""}
                      onChange={(e) => setSampleSize(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="Analyze all"
                      className="bg-slate-800/50 border-slate-700"
                    />
                    <p className="text-[10px] text-gray-500">Limits vectors for faster analysis</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Batch Size</Label>
                    <Input
                      type="number"
                      min={100}
                      value={batchSize}
                      onChange={(e) => setBatchSize(Number(e.target.value))}
                      className="bg-slate-800/50 border-slate-700"
                    />
                    <p className="text-[10px] text-gray-500">Processing granularity</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Similarity Threshold</Label>
                    <Input
                      type="number"
                      min={0.8}
                      max={1.0}
                      step={0.01}
                      value={collisionThreshold}
                      onChange={(e) => setCollisionThreshold(Number(e.target.value))}
                      className="bg-slate-800/50 border-slate-700"
                    />
                    <p className="text-[10px] text-gray-500">Cutoff for collision detection</p>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleAnalyze}
                    disabled={
                      isLoading || 
                      (sourceType === 'json_upload' && !file) ||
                      (sourceType === 'pinecone' && (!pineconeApiKey || !pineconeIndexName))
                    }
                    className="bg-blue-600 hover:bg-blue-500 text-white min-w-[160px]"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" /> 
                        {sourceType === 'json_upload' ? 'Analyze Snapshot' : 'Scan Vector DB'}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-blue-400" />
                  Security Modules
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-white">Dense Clusters</Label>
                    <p className="text-[10px] text-gray-400">Detect cross-tenant poisoning</p>
                  </div>
                  <Switch checked={enableClustering} onCheckedChange={setEnableClustering} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-white">Collision Detect</Label>
                    <p className="text-[10px] text-gray-400">Topic-to-topic collisions</p>
                  </div>
                  <Switch checked={enableCollision} onCheckedChange={setEnableCollision} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-white">Outlier Scoring</Label>
                    <p className="text-[10px] text-gray-400">Isolation Forest anomalies</p>
                  </div>
                  <Switch checked={enableOutlier} onCheckedChange={setEnableOutlier} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-white">Trigger Scan</Label>
                    <p className="text-[10px] text-gray-400">Advanced injection patterns</p>
                  </div>
                  <Switch checked={enableTrigger} onCheckedChange={setEnableTrigger} />
                </div>
              </CardContent>
            </Card>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400 text-sm">
              <XCircle className="w-5 h-5" />
              {error}
            </div>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {isLoading && !result && (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                <Database className="w-6 h-6 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="text-gray-300 font-medium">Crunching vector data...</div>
              <div className="text-xs text-gray-500 italic max-w-xs text-center">
                Computing cosine similarities and running DBSCAN clustering on sampled neighbors.
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-400" />
                      Security Posture Summary
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleExportReport('json')}
                        disabled={isExporting}
                        variant="outline"
                        size="sm"
                        className="border-slate-600 hover:border-blue-500"
                      >
                        {isExporting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <FileDown className="w-4 h-4 mr-1" /> JSON
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => handleExportReport('pdf')}
                        disabled={isExporting}
                        className="bg-blue-600 hover:bg-blue-500"
                        size="sm"
                      >
                        {isExporting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-1" /> Report
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Scope</div>
                      <div className="text-2xl font-bold text-white">{result.total_vectors.toLocaleString()}</div>
                      <div className="text-[10px] text-gray-500 mt-1">Vectors in snapshot</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Confidence</div>
                      <div className="text-2xl font-bold text-blue-400">{(result.confidence * 100).toFixed(1)}%</div>
                      <div className="text-[10px] text-gray-500 mt-1">Analysis reliability</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Findings</div>
                      <div className={`text-2xl font-bold ${result.findings.length > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {result.findings.length}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1">Detected anomalies</div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Anom. Rate</div>
                      <div className="text-2xl font-bold text-white">{(result.summary.anomaly_rate * 100).toFixed(2)}%</div>
                      <div className="text-[10px] text-gray-500 mt-1">Findings / Analyzed</div>
                    </div>
                  </div>

                  {result.distribution_stats && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700 shadow-inner">
                          <div className="text-gray-400 mb-3 flex items-center gap-2 text-sm">
                            <Box className="w-4 h-4 text-blue-400" />
                            Embedding Distribution
                          </div>
                          <div className="grid grid-cols-2 gap-y-3 text-sm">
                            <div className="text-gray-500">Mean L2 Norm:</div>
                            <div className="text-white font-mono text-right">{result.distribution_stats.mean_norm?.toFixed(4)}</div>
                            <div className="text-gray-500">Stability (Std):</div>
                            <div className="text-white font-mono text-right">{result.distribution_stats.std_norm?.toFixed(4)}</div>
                            <div className="text-gray-500">Vector Dims:</div>
                            <div className="text-white font-mono text-right">{result.distribution_stats.dimension}</div>
                          </div>
                        </div>
                        <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700 shadow-inner">
                          <div className="text-gray-400 mb-3 flex items-center gap-2 text-sm">
                            <TrendingUp className="w-4 h-4 text-blue-400" />
                            Retrieval Integrity
                          </div>
                          <div className="grid grid-cols-2 gap-y-3 text-sm">
                            <div className="text-gray-500">Global Similarity:</div>
                            <div className="text-white font-mono text-right">{result.distribution_stats.avg_similarity?.toFixed(4)}</div>
                            <div className="text-gray-500">Collision Rate:</div>
                            <div className="text-white font-mono text-right">{(result.distribution_stats.collision_rate * 100).toFixed(3)}%</div>
                            <div className="text-gray-500">Status:</div>
                            <div className="text-right">
                              {result.distribution_stats.collision_rate > 0.05 ?
                                <Badge className="bg-red-500/20 text-red-400 border-red-500/50 py-0">High Collision</Badge> :
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50 py-0">Optimal</Badge>
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Visual Health Bar */}
                      <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700">
                        <div className="text-gray-400 mb-4 flex items-center gap-2 text-sm">
                          <BarChart className="w-4 h-4 text-blue-400" />
                          Store Health Indicators
                        </div>
                        <div className="space-y-4">
                          {/* Collision Rate Bar */}
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Collision Rate</span>
                              <span className="text-gray-300">{(result.distribution_stats.collision_rate * 100).toFixed(2)}%</span>
                            </div>
                            <div className="h-2 bg-slate-900/60 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all ${
                                  result.distribution_stats.collision_rate > 0.05 ? 'bg-red-500' :
                                  result.distribution_stats.collision_rate > 0.02 ? 'bg-amber-500' :
                                  'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(result.distribution_stats.collision_rate * 100 * 10, 100)}%` }}
                              />
                            </div>
                          </div>
                          
                          {/* Anomaly Rate Bar */}
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Anomaly Rate</span>
                              <span className="text-gray-300">{(result.summary.anomaly_rate * 100).toFixed(2)}%</span>
                            </div>
                            <div className="h-2 bg-slate-900/60 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all ${
                                  result.summary.anomaly_rate > 0.1 ? 'bg-red-500' :
                                  result.summary.anomaly_rate > 0.05 ? 'bg-amber-500' :
                                  'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(result.summary.anomaly_rate * 100 * 5, 100)}%` }}
                              />
                            </div>
                          </div>
                          
                          {/* Confidence Bar */}
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Analysis Confidence</span>
                              <span className="text-gray-300">{(result.confidence * 100).toFixed(1)}%</span>
                            </div>
                            <div className="h-2 bg-slate-900/60 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 transition-all"
                                style={{ width: `${result.confidence * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {result.recommendations.length > 0 && (
                <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">System Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {result.recommendations.map((rec, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                          <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-300">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="findings" className="space-y-6">
          {result && result.findings.length > 0 && (
            <>
              {/* Bulk Actions Card */}
              {selectedForQuarantine.size > 0 && (
                <Card className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-blue-500/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-blue-400" />
                        <div>
                          <div className="text-white font-semibold">{selectedForQuarantine.size} vectors selected for quarantine</div>
                          <div className="text-xs text-gray-400">These vectors will be flagged for isolation or re-embedding</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedForQuarantine(new Set())}
                          className="border-slate-600"
                        >
                          Clear Selection
                        </Button>
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-500"
                          onClick={() => handleExportReport('json')}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Export Quarantine List
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            
              <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-sm">
                <CardHeader className="border-b border-slate-800 mb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                      Flagged Anomalies ({result.findings.length})
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (selectedForQuarantine.size === result.findings.length) {
                          setSelectedForQuarantine(new Set())
                        } else {
                          setSelectedForQuarantine(new Set(result.findings.map((f, idx) => 
                            String(f.record_id || f.vector_id || `finding-${idx}`)
                          )))
                        }
                      }}
                      className="text-gray-400 hover:text-white"
                    >
                      {selectedForQuarantine.size === result.findings.length ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topFindings(result.findings).map((finding, idx) => {
                  const rawId = finding.record_id || finding.vector_id || `finding-${idx}`
                  const findingId = String(rawId)
                  const isSelected = selectedForQuarantine.has(findingId)
                  
                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border transition-all relative overflow-hidden ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-500/10' 
                          : 'border-slate-700 bg-slate-800/40 hover:bg-slate-800/60 hover:border-blue-500/50'
                      }`}
                    >
                      <div className="absolute top-2 right-2 flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleQuarantine(findingId)
                          }}
                          className={`p-1.5 rounded transition-all ${
                            isSelected 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-slate-700/50 text-gray-400 hover:bg-slate-600'
                          }`}
                          title={isSelected ? "Remove from quarantine" : "Add to quarantine"}
                        >
                          <Lock className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openFindingDetails(finding)
                          }}
                          className="p-1.5 rounded bg-slate-700/50 text-gray-400 hover:bg-slate-600 transition-all"
                          title="View details"
                        >
                          <Info className="w-3 h-3" />
                        </button>
                      </div>
                    <div className="flex items-center gap-2 mb-3">
                      {confidenceBadge(finding.confidence)}
                      {categoryBadge(finding.category)}
                    </div>
                    <div className="text-sm text-gray-100 mb-3 font-medium line-clamp-2">{finding.description}</div>
                    <div className="text-[11px] text-gray-500 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <Database className="w-3 h-3" />
                        <span className="truncate">ID: {finding.record_id || finding.vector_id}</span>
                      </div>
                      {finding.source_doc && (
                        <div className="flex items-center gap-1.5">
                          <Info className="w-3 h-3" />
                          <span className="truncate">Source: {finding.source_doc}</span>
                        </div>
                      )}
                    </div>
                    </div>
                  )
                })}
              </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ShieldAlert className="w-6 h-6 text-amber-500" />
              Finding Details
            </DialogTitle>
          </DialogHeader>

          {selectedFinding && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 uppercase font-bold">Category</span>
                  <div className="flex">{categoryBadge(selectedFinding.category)}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-slate-500 uppercase font-bold">Confidence</span>
                  <div className="flex">{confidenceBadge(selectedFinding.confidence)}</div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs text-slate-500 uppercase font-bold">Description</span>
                <p className="text-sm text-slate-200 bg-slate-800/50 p-3 rounded border border-slate-700">
                  {selectedFinding.description}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400 uppercase font-bold">
                    <Database className="w-3 h-3" />
                    Record Information
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b border-slate-800 pb-1">
                      <span className="text-slate-500">Vector ID:</span>
                      <span className="text-slate-200">{selectedFinding.record_id || selectedFinding.vector_id}</span>
                    </div>
                    {selectedFinding.source_doc && (
                      <div className="flex justify-between border-b border-slate-800 pb-1">
                        <span className="text-slate-500">Source Doc:</span>
                        <span className="text-slate-200 truncate ml-4" title={selectedFinding.source_doc}>{selectedFinding.source_doc}</span>
                      </div>
                    )}
                    {selectedFinding.norm && (
                      <div className="flex justify-between border-b border-slate-800 pb-1">
                        <span className="text-slate-500">L2 Norm:</span>
                        <span className="font-mono text-slate-200">{selectedFinding.norm.toFixed(6)}</span>
                      </div>
                    )}
                    {selectedFinding.z_score !== undefined && (
                      <div className="flex justify-between border-b border-slate-800 pb-1">
                        <span className="text-slate-500">Z-Score:</span>
                        <span className={`font-mono ${Math.abs(selectedFinding.z_score || 0) > 3 ? 'text-red-400' : 'text-slate-200'}`}>
                          {selectedFinding.z_score?.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400 uppercase font-bold">
                    <Users className="w-3 h-3" />
                    Context & neighbors
                  </div>
                  <div className="space-y-2 text-xs">
                    {selectedFinding.tenants && selectedFinding.tenants.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-slate-500">Involved Tenants:</span>
                        <div className="flex flex-wrap gap-1">
                          {selectedFinding.tenants.map(t => <Badge key={t} variant="outline" className="text-[9px] py-0 h-4">{t}</Badge>)}
                        </div>
                      </div>
                    )}
                    {selectedFinding.nearest_neighbors && selectedFinding.nearest_neighbors.length > 0 ? (
                      <div className="space-y-1">
                        <span className="text-slate-500">Nearest Neighbors:</span>
                        <div className="space-y-1">
                          {selectedFinding.nearest_neighbors.map((n, i) => (
                            <div key={i} className="flex justify-between text-[10px] bg-slate-800/30 p-1 rounded">
                              <span className="text-slate-400 truncate w-24">ID: {n.record_id || n.vector_id}</span>
                              <span className="text-blue-400">Sim: {n.similarity.toFixed(4)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-slate-600 italic">No neighbor data available</div>
                    )}
                  </div>
                </div>
              </div>

              {selectedFinding.metadata && Object.keys(selectedFinding.metadata).length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs text-slate-500 uppercase font-bold">Metadata Snippet</span>
                  <pre className="text-[10px] bg-black/40 p-2 rounded overflow-x-auto text-emerald-400/80 max-h-32">
                    {JSON.stringify(selectedFinding.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <div className="p-3 bg-blue-900/20 border border-blue-800/50 rounded flex gap-3">
                <CheckCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="text-sm font-bold text-blue-300">Recommended Action</div>
                  <div className="text-xs text-blue-200/80 leading-relaxed">{selectedFinding.recommended_action}</div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsDetailsOpen(false)} className="bg-slate-800 hover:bg-slate-700 mt-2">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

