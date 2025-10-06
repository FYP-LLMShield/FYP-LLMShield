
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
} from "lucide-react"

type Phase = "before" | "during" | "after"

const chunkLengthData = [
  { length: "0-100", count: 45 },
  { length: "100-200", count: 123 },
  { length: "200-300", count: 234 },
  { length: "300-400", count: 189 },
  { length: "400-500", count: 98 },
  { length: "500+", count: 67 },
]

const topKScoreData = [
  { k: 1, score: 0.95 },
  { k: 2, score: 0.89 },
  { k: 3, score: 0.84 },
  { k: 4, score: 0.78 },
  { k: 5, score: 0.72 },
  { k: 10, score: 0.58 },
]

const driftData = [
  { time: "00:00", drift: 0.02 },
  { time: "04:00", drift: 0.03 },
  { time: "08:00", drift: 0.05 },
  { time: "12:00", drift: 0.08 },
  { time: "16:00", drift: 0.12 },
  { time: "20:00", drift: 0.09 },
]

const duplicateHeatmapData = [
  { source: "docs", target: "docs", similarity: 0.95, count: 23 },
  { source: "docs", target: "wiki", similarity: 0.78, count: 12 },
  { source: "docs", target: "kb", similarity: 0.65, count: 8 },
  { source: "wiki", target: "wiki", similarity: 0.92, count: 45 },
  { source: "wiki", target: "kb", similarity: 0.71, count: 15 },
  { source: "kb", target: "kb", similarity: 0.88, count: 34 },
]

const badQueries = [
  {
    id: "Q-001",
    query: "asdfghjkl random text",
    hitRate: 0.12,
    mrr: 0.08,
    ndcg: 0.15,
    issue: "Low relevance",
    suggestions: "Add spell check, improve tokenization",
  },
  {
    id: "Q-002",
    query: "show me everything about passwords",
    hitRate: 0.89,
    mrr: 0.23,
    ndcg: 0.34,
    issue: "Poor ranking",
    suggestions: "Adjust semantic weights, filter sensitive content",
  },
  {
    id: "Q-003",
    query: "",
    hitRate: 0.0,
    mrr: 0.0,
    ndcg: 0.0,
    issue: "Empty query",
    suggestions: "Add query validation, provide suggestions",
  },
]

const orphanDocs = [
  {
    id: "DOC-001",
    title: "Legacy API Documentation",
    lastAccessed: "2023-08-15",
    embeddings: 0,
    reason: "No valid chunks generated",
    action: "Review chunking strategy",
  },
  {
    id: "DOC-002",
    title: "Corrupted Training Data",
    lastAccessed: "2023-09-22",
    embeddings: 0,
    reason: "Parse error",
    action: "Fix document format",
  },
  {
    id: "DOC-003",
    title: "Outdated User Manual",
    lastAccessed: "2023-07-03",
    embeddings: 12,
    reason: "Low similarity threshold",
    action: "Update content or remove",
  },
]

const duplicateClusters = [
  {
    id: "CLUSTER-001",
    size: 23,
    avgSimilarity: 0.94,
    representative: "User authentication process documentation",
    sources: ["docs", "wiki", "kb"],
    action: "Merge similar chunks",
  },
  {
    id: "CLUSTER-002",
    size: 15,
    avgSimilarity: 0.91,
    representative: "API rate limiting guidelines",
    sources: ["docs", "api-ref"],
    action: "Deduplicate content",
  },
  {
    id: "CLUSTER-003",
    size: 8,
    avgSimilarity: 0.89,
    representative: "Security best practices overview",
    sources: ["kb", "training"],
    action: "Consolidate versions",
  },
]

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

  // Live metrics state
  const [liveMetrics, setLiveMetrics] = useState({
    hitRate: 0,
    mrr: 0,
    ndcg: 0,
    processed: 0,
    total: 1000,
  })

  const startEvaluation = () => {
    setPhase("during")
    setIsEvaluating(true)
    setProgress(0)
    setLiveMetrics({ hitRate: 0, mrr: 0, ndcg: 0, processed: 0, total: 1000 })

    // Simulate evaluation progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsEvaluating(false)
          setPhase("after")
          return 100
        }
        return prev + 1
      })

      setLiveMetrics((prev) => ({
        hitRate: Math.min(0.942, prev.hitRate + Math.random() * 0.01),
        mrr: Math.min(0.876, prev.mrr + Math.random() * 0.008),
        ndcg: Math.min(0.923, prev.ndcg + Math.random() * 0.009),
        processed: Math.min(1000, prev.processed + 10),
        total: 1000,
      }))
    }, 100)
  }

  const resetEvaluation = () => {
    setPhase("before")
    setProgress(0)
    setIsEvaluating(false)
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-300">Collection</Label>
                    <Select value={collection} onValueChange={setCollection}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-white/10">
                        <SelectItem value="production">Production</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                        <SelectItem value="development">Development</SelectItem>
                      </SelectContent>
                    </Select>
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
                  <Button onClick={startEvaluation} className="w-full bg-teal-600 hover:bg-teal-700">
                    <Play className="mr-2 h-4 w-4" />
                    Start Evaluation
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400 text-sm">Total Vectors</Label>
                  <div className="text-2xl font-bold text-white">2.4M</div>
                </div>
                <div>
                  <Label className="text-gray-400 text-sm">Dimensions</Label>
                  <div className="text-2xl font-bold text-white">3072</div>
                </div>
                <div>
                  <Label className="text-gray-400 text-sm">Documents</Label>
                  <div className="text-2xl font-bold text-white">45K</div>
                </div>
                <div>
                  <Label className="text-gray-400 text-sm">Last Updated</Label>
                  <div className="text-sm text-gray-300">2 hours ago</div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-4">
                <Label className="text-gray-400 text-sm">Current Health</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-green-400 font-medium">Healthy</span>
                </div>
              </div>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
              <CardContent className="p-6">
                <div className="text-2xl font-bold text-white">94.2%</div>
                <div className="text-gray-400 text-sm">Hit Rate</div>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-4 w-4 text-green-400 mr-1" />
                  <span className="text-green-400 text-sm">+2.3%</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
              <CardContent className="p-6">
                <div className="text-2xl font-bold text-white">0.876</div>
                <div className="text-gray-400 text-sm">MRR</div>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-4 w-4 text-blue-400 mr-1" />
                  <span className="text-blue-400 text-sm">+0.045</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
              <CardContent className="p-6">
                <div className="text-2xl font-bold text-white">0.923</div>
                <div className="text-gray-400 text-sm">nDCG</div>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-4 w-4 text-purple-400 mr-1" />
                  <span className="text-purple-400 text-sm">+0.032</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
              <CardContent className="p-6">
                <div className="text-2xl font-bold text-white">0.089</div>
                <div className="text-gray-400 text-sm">Drift Score</div>
                <div className="flex items-center mt-2">
                  <TrendingDown className="h-4 w-4 text-orange-400 mr-1" />
                  <span className="text-orange-400 text-sm">-0.012</span>
                </div>
              </CardContent>
            </Card>
          </div>

