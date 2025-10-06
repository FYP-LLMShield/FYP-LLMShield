
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
