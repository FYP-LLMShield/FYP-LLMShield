
"use client"

import { useState } from "react"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Badge } from "../ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { Progress } from "../ui/progress"
import { Switch } from "../ui/switch"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import {
  Play,
  Pause,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Database,
  Settings,
  Download,
  CheckCircle,
  Upload,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { vectorEmbeddingEvaluationAPI, EvaluationResponse } from "../../lib/api"

type Phase = "before" | "during" | "after"

export function VectorEmbeddingPage() {
  const [phase, setPhase] = useState<Phase>("before")
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [collection, setCollection] = useState("production")
  const [embeddingModel, setEmbeddingModel] = useState("text-embedding-3-large")
  const [k, setK] = useState("10")
  const [chunkSize, setChunkSize] = useState("512")
  const [overlap, setOverlap] = useState("50")
  const [rerankerEnabled, setRerankerEnabled] = useState(true)
  const [vectorsFile, setVectorsFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResponse | null>(null)

  // Live metrics state
  const [liveMetrics, setLiveMetrics] = useState({
    hitRate: 0,
    mrr: 0,
    ndcg: 0,
    processed: 0,
    total: 1000,
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVectorsFile(e.target.files[0])
      setError(null)
    }
  }

  const startEvaluation = async () => {
    if (!vectorsFile) {
      setError("Please upload a vector snapshot file first")
      return
    }

    setPhase("during")
    setIsEvaluating(true)
    setProgress(0)
    setError(null)
    setLiveMetrics({ hitRate: 0, mrr: 0, ndcg: 0, processed: 0, total: 1000 })

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            return 90
          }
          return prev + 5
        })
      }, 200)

      const result = await vectorEmbeddingEvaluationAPI.evaluate(
        {
          collection_name: collection,
          embedding_model: embeddingModel,
          k: parseInt(k) || 10,
          chunk_size: chunkSize ? parseInt(chunkSize) : undefined,
          overlap: overlap ? parseInt(overlap) : undefined,
          reranker_enabled: rerankerEnabled,
        },
        vectorsFile
      )

      clearInterval(progressInterval)
      setProgress(100)

      if (result.success && result.data) {
        setEvaluationResult(result.data as EvaluationResponse)
        setLiveMetrics({
          hitRate: result.data.metrics.hit_rate,
          mrr: result.data.metrics.mrr,
          ndcg: result.data.metrics.ndcg,
          processed: result.data.metrics.processed_queries,
          total: result.data.metrics.total_queries,
        })
        setPhase("after")
      } else {
        setError(result.error || "Evaluation failed")
        setPhase("before")
      }
    } catch (err: any) {
      setError(err?.message || "Evaluation failed")
      setPhase("before")
    } finally {
      setIsEvaluating(false)
    }
  }

  const resetEvaluation = () => {
    setPhase("before")
    setProgress(0)
    setIsEvaluating(false)
    setEvaluationResult(null)
    setError(null)
  }

  return (
    <div className="p-6 space-y-6 min-h-screen" style={{backgroundColor: '#1d2736'}}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Vector Embedding Evaluation</h1>
          <p className="text-gray-400 mt-2">Evaluate and monitor the health of your vector embeddings</p>
        </div>
        {phase !== "before" && (
          <Button
            onClick={resetEvaluation}
            variant="outline"
            className="border-white/20 text-gray-300 hover:bg-white/10 bg-transparent"
          >
            New Evaluation
          </Button>
        )}
      </div>

      {phase === "before" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Evaluation Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* File Upload */}
                <div>
                  <Label className="text-gray-300">Vector Snapshot File</Label>
                  <div className="mt-2">
                    <Input
                      type="file"
                      accept=".json"
                      onChange={handleFileChange}
                      className="bg-white/5 border-white/10 text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-teal-600 file:text-white hover:file:bg-teal-700"
                    />
                    {vectorsFile && (
                      <p className="text-sm text-gray-400 mt-2">
                        Selected: {vectorsFile.name} ({(vectorsFile.size / 1024).toFixed(2)} KB)
                      </p>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <span className="text-red-400 text-sm">{error}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-300">Collection</Label>
                    <Input
                      value={collection}
                      onChange={(e) => setCollection(e.target.value)}
                      className="bg-white/5 border-white/10 text-white"
                      placeholder="production"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300">Embedding Model</Label>
                    <Select value={embeddingModel} onValueChange={setEmbeddingModel}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-white/10">
                        <SelectItem value="text-embedding-3-large">text-embedding-3-large</SelectItem>
                        <SelectItem value="text-embedding-3-small">text-embedding-3-small</SelectItem>
                        <SelectItem value="text-embedding-ada-002">text-embedding-ada-002</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-gray-300">Top-K Results</Label>
                    <Input
                      value={k}
                      onChange={(e) => setK(e.target.value)}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300">Chunk Size</Label>
                    <Input
                      value={chunkSize}
                      onChange={(e) => setChunkSize(e.target.value)}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-gray-300">Overlap (tokens)</Label>
                    <Input
                      value={overlap}
                      onChange={(e) => setOverlap(e.target.value)}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-gray-300">Reranker</Label>
                    <Switch checked={rerankerEnabled} onCheckedChange={setRerankerEnabled} />
                  </div>
                </div>

                <div className="pt-4">
                  <Button 
                    onClick={startEvaluation} 
                    className="w-full bg-teal-600 hover:bg-teal-700"
                    disabled={!vectorsFile || isEvaluating}
                  >
                    {isEvaluating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Evaluating...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Start Evaluation
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Collection Info */}
          <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Collection Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {vectorsFile ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-400 text-sm">File Name</Label>
                      <div className="text-sm font-bold text-white truncate">{vectorsFile.name}</div>
                    </div>
                    <div>
                      <Label className="text-gray-400 text-sm">File Size</Label>
                      <div className="text-sm font-bold text-white">{(vectorsFile.size / 1024).toFixed(2)} KB</div>
                    </div>
                    <div>
                      <Label className="text-gray-400 text-sm">Collection</Label>
                      <div className="text-sm font-bold text-white">{collection}</div>
                    </div>
                    <div>
                      <Label className="text-gray-400 text-sm">Model</Label>
                      <div className="text-sm font-bold text-white">{embeddingModel}</div>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-4">
                    <Label className="text-gray-400 text-sm">Status</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                      <span className="text-green-400 font-medium">Ready to Evaluate</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Upload className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 text-sm">Upload a vector snapshot file to begin</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {phase === "during" && (
        <div className="space-y-6">
          <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Evaluation Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Progress value={progress} className="w-full" />
                <div className="flex justify-between text-sm text-gray-400">
                  <span>
                    Processing queries... {liveMetrics.processed}/{liveMetrics.total}
                  </span>
                  <span>{progress}% complete</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-white">{(liveMetrics.hitRate * 100).toFixed(1)}%</div>
                    <div className="text-gray-400 text-sm">Hit Rate</div>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-white">{liveMetrics.mrr.toFixed(3)}</div>
                    <div className="text-gray-400 text-sm">MRR</div>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-white">{liveMetrics.ndcg.toFixed(3)}</div>
                    <div className="text-gray-400 text-sm">nDCG</div>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Controls */}
          <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4">
                <Button
                  variant="outline"
                  className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-600/10 bg-transparent"
                  disabled={!isEvaluating}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Pause Evaluation
                </Button>
                <Button
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-600/10 bg-transparent"
                  onClick={resetEvaluation}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {phase === "after" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          {evaluationResult && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-white">{(evaluationResult.metrics.hit_rate * 100).toFixed(1)}%</div>
                  <div className="text-gray-400 text-sm">Hit Rate</div>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="h-4 w-4 text-green-400 mr-1" />
                    <span className="text-green-400 text-sm">{evaluationResult.metrics.processed_queries} queries</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-white">{evaluationResult.metrics.mrr.toFixed(3)}</div>
                  <div className="text-gray-400 text-sm">MRR</div>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="h-4 w-4 text-blue-400 mr-1" />
                    <span className="text-blue-400 text-sm">Mean Reciprocal Rank</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-white">{evaluationResult.metrics.ndcg.toFixed(3)}</div>
                  <div className="text-gray-400 text-sm">nDCG</div>
                  <div className="flex items-center mt-2">
                    <TrendingUp className="h-4 w-4 text-purple-400 mr-1" />
                    <span className="text-purple-400 text-sm">Normalized DCG</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-white">
                    {evaluationResult.drift_detection 
                      ? evaluationResult.drift_detection.drift_score.toFixed(3)
                      : "N/A"}
                  </div>
                  <div className="text-gray-400 text-sm">Drift Score</div>
                  <div className="flex items-center mt-2">
                    {evaluationResult.drift_detection?.drift_detected ? (
                      <>
                        <TrendingDown className="h-4 w-4 text-orange-400 mr-1" />
                        <span className="text-orange-400 text-sm">Drift detected</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-400 mr-1" />
                        <span className="text-green-400 text-sm">No drift</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Chunk Length Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {evaluationResult?.chunk_length_distribution ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={evaluationResult.chunk_length_distribution.bins.map((bin, i) => ({
                      length: bin,
                      count: evaluationResult.chunk_length_distribution!.counts[i]
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="length" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1F2937",
                          border: "1px solid #374151",
                          borderRadius: "8px",
                          color: "#F9FAFB",
                        }}
                      />
                      <Bar dataKey="count" fill="#14B8A6" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-gray-400 text-center py-20">No chunk distribution data</div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Top-K Score Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {evaluationResult?.top_k_scores ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={Object.entries(evaluationResult.top_k_scores)
                      .filter(([key]) => key.startsWith("hit_rate@"))
                      .map(([key, value]) => ({
                        k: parseInt(key.replace("hit_rate@", "")),
                        score: value
                      }))
                      .sort((a, b) => a.k - b.k)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="k" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1F2937",
                          border: "1px solid #374151",
                          borderRadius: "8px",
                          color: "#F9FAFB",
                        }}
                      />
                      <Line type="monotone" dataKey="score" stroke="#3B82F6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-gray-400 text-center py-20">No top-K score data</div>
                )}
              </CardContent>
            </Card>

            {evaluationResult?.drift_detection && (
              <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Drift Detection</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Drift Score</span>
                      <span className="text-white font-bold">
                        {evaluationResult.drift_detection.drift_score.toFixed(3)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Status</span>
                      <Badge 
                        variant="outline" 
                        className={evaluationResult.drift_detection.drift_detected 
                          ? "border-orange-500/30 text-orange-400"
                          : "border-green-500/30 text-green-400"
                        }
                      >
                        {evaluationResult.drift_detection.drift_detected ? "Drift Detected" : "No Drift"}
                      </Badge>
                    </div>
                    {evaluationResult.drift_detection.recommendations.length > 0 && (
                      <div className="mt-4">
                        <Label className="text-gray-400 text-sm">Recommendations</Label>
                        <ul className="mt-2 space-y-1">
                          {evaluationResult.drift_detection.recommendations.map((rec, i) => (
                            <li key={i} className="text-sm text-gray-300">• {rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {evaluationResult?.recommendations && evaluationResult.recommendations.length > 0 && (
              <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {evaluationResult.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-gray-300 flex items-start">
                        <CheckCircle className="h-4 w-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Poor Performing Queries</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-gray-400">Query</TableHead>
                      <TableHead className="text-gray-400">Hit Rate</TableHead>
                      <TableHead className="text-gray-400">Issue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evaluationResult?.poor_performing_queries && evaluationResult.poor_performing_queries.length > 0 ? (
                      evaluationResult.poor_performing_queries.map((query) => (
                        <TableRow key={query.query_id} className="border-white/10 hover:bg-white/5">
                          <TableCell className="max-w-48">
                            <div className="text-gray-300 text-sm truncate">{query.query_text || "<empty>"}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-white font-medium">{(query.hit_rate * 100).toFixed(1)}%</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-red-500/30 text-red-400">
                              {query.issue}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-gray-400 py-8">
                          No poor performing queries found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Orphan Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-gray-400">Document</TableHead>
                      <TableHead className="text-gray-400">Embeddings</TableHead>
                      <TableHead className="text-gray-400">Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evaluationResult?.orphan_documents && evaluationResult.orphan_documents.length > 0 ? (
                      evaluationResult.orphan_documents.map((doc) => (
                        <TableRow key={doc.document_id} className="border-white/10 hover:bg-white/5">
                          <TableCell>
                            <div className="text-gray-300 text-sm">{doc.title}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-white font-medium">{doc.embedding_count}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
                              {doc.reason}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-gray-400 py-8">
                          No orphan documents found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Duplicate Clusters */}
          <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Duplicate Clusters</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-gray-400">Cluster</TableHead>
                    <TableHead className="text-gray-400">Size</TableHead>
                    <TableHead className="text-gray-400">Similarity</TableHead>
                    <TableHead className="text-gray-400">Representative</TableHead>
                    <TableHead className="text-gray-400">Sources</TableHead>
                    <TableHead className="text-gray-400">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluationResult?.duplicate_clusters && evaluationResult.duplicate_clusters.length > 0 ? (
                    evaluationResult.duplicate_clusters.map((cluster) => (
                      <TableRow key={cluster.cluster_id} className="border-white/10 hover:bg-white/5">
                        <TableCell className="text-white font-mono">{cluster.cluster_id}</TableCell>
                        <TableCell className="text-white font-medium">{cluster.size}</TableCell>
                        <TableCell className="text-white">{(cluster.avg_similarity * 100).toFixed(1)}%</TableCell>
                        <TableCell className="max-w-64">
                          <div className="text-gray-300 text-sm truncate">{cluster.representative_text}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {cluster.sources.map((source) => (
                              <Badge key={source} variant="secondary" className="bg-blue-600/20 text-blue-400 text-xs">
                                {source}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-green-500/30 text-green-400">
                            {cluster.action}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                        No duplicate clusters found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4">
            <Button className="bg-teal-600 hover:bg-teal-700">
              <Settings className="mr-2 h-4 w-4" />
              Suggest Chunking
            </Button>
            <Button variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-600/10 bg-transparent">
              <Database className="mr-2 h-4 w-4" />
              Rebuild Index
            </Button>
            <Button
              variant="outline"
              className="border-purple-500/30 text-purple-400 hover:bg-purple-600/10 bg-transparent"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Switch Reranker
            </Button>
            <Button
              variant="outline"
              className="border-green-500/30 text-green-400 hover:bg-green-600/10 bg-transparent"
            >
              <Play className="mr-2 h-4 w-4" />
              Re-evaluate
            </Button>
            <Button
              variant="outline"
              className="border-orange-500/30 text-orange-400 hover:bg-orange-600/10 bg-transparent"
              onClick={() => evaluationResult && vectorEmbeddingEvaluationAPI.exportReport(evaluationResult, "pdf")}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
