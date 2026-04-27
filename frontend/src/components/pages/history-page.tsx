"use client"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Badge } from "../ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Calendar } from "../ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import {
  History,
  Search,
  Download,
  CalendarIcon,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { format } from "date-fns"
import { scanHistoryAPI, type ScanHistoryStats } from "../../lib/api"

interface ScanHistoryItem {
  id: string
  scan_id: string
  scan_type?: string
  input_type?: string
  input_size: number
  scan_duration: number
  findings_count: number
  high_risk_count: number
  medium_risk_count: number
  low_risk_count: number
  created_at: string
}

interface HistoryEvent {
  id: string
  type: "scan" | "alert" | "action" | "login"
  title: string
  description: string
  timestamp: Date
  user: string
  status: "success" | "warning" | "error" | "info"
  module: string
  details?: Record<string, any>
}

const MODULE_LABELS: Record<string, string> = {
  code_scanning: "Code / hybrid",
  prompt_injection: "Prompt injection",
  data_poisoning: "Data poisoning",
  vector_security: "Vector / anomaly",
  embedding_inspection: "Embedding inspection",
  retrieval_simulation: "Retrieval attack",
}

export function HistoryPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterModule, setFilterModule] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [dateRange, setDateRange] = useState<Date | undefined>(new Date())
  
  // New state for real scan history data
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<ScanHistoryStats | null>(null)

  // Fetch scan history + aggregate stats (backend: GET /scan-history/)
  const fetchScanHistory = async (page: number = 1) => {
    try {
      setIsLoading(true)
      setError(null)

      const inputType = filterType === "all" ? undefined : filterType
      const scanType = filterModule === "all" ? undefined : filterModule
      const [response, statsResponse] = await Promise.all([
        scanHistoryAPI.getHistory(page, 20, inputType, scanType),
        scanHistoryAPI.getStats(inputType, scanType),
      ])

      if (response.success && response.data) {
        setScanHistory(response.data.scans ?? [])
        setTotalPages(response.data.total_pages ?? 1)
        setTotal(response.data.total ?? 0)
        setCurrentPage(response.data.page ?? page)
      } else {
        setScanHistory([])
        setError(response.error || "Failed to fetch scan history")
      }

      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data as ScanHistoryStats)
      } else if (response.success) {
        setStats(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch scan history")
    } finally {
      setIsLoading(false)
    }
  }

  // Load data on component mount and when filters change
  useEffect(() => {
    fetchScanHistory(1)
  }, [filterType, filterModule])

  // Convert scan history to display format
  const convertScanToHistoryEvent = (scan: ScanHistoryItem): HistoryEvent => {
    const status = scan.high_risk_count > 0 ? "error" : 
                  scan.medium_risk_count > 0 ? "warning" : "success"

    const it = scan.input_type || ""
    const st = scan.scan_type || "code_scanning"
    const moduleLabel = MODULE_LABELS[st] || st.replace(/_/g, " ")

    const inputTypeDisplay =
      it === "text" || st === "text"
        ? "Text"
        : it === "file" || it === "file_upload" || st === "file" || st === "file_upload"
          ? "File"
          : it === "github" || st === "github" || st === "github_repo"
            ? "GitHub"
            : it === "json"
              ? "JSON / snapshot"
              : it === "other"
                ? "Other"
                : "Mixed"
    
    const description = scan.findings_count > 0 
      ? `Found ${scan.findings_count} findings (${scan.high_risk_count} high, ${scan.medium_risk_count} medium, ${scan.low_risk_count} low risk)`
      : "No security issues found"

    return {
      id: scan.id,
      type: "scan",
      title: `${moduleLabel} · ${inputTypeDisplay}`,
      description,
      timestamp: new Date(scan.created_at),
      user: "current_user", // We could get this from auth context
      status,
      module: moduleLabel,
      details: {
        scan_id: scan.scan_id,
        duration: `${Math.round(scan.scan_duration)}s`,
        input_size: scan.input_size,
        findings: scan.findings_count
      }
    }
  }

  // Convert scan history to events for display
  const historyEvents = (scanHistory || []).map(convertScanToHistoryEvent)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />
      case "error":
        return <AlertTriangle className="w-4 h-4 text-red-400" />
      case "info":
        return <Shield className="w-4 h-4 text-blue-400" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-600"
      case "warning":
        return "bg-yellow-600"
      case "error":
        return "bg-red-600"
      case "info":
        return "bg-blue-600"
      default:
        return "bg-gray-600"
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "scan":
        return <Search className="w-4 h-4" />
      case "alert":
        return <AlertTriangle className="w-4 h-4" />
      case "action":
        return <Shield className="w-4 h-4" />
      case "login":
        return <User className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  const filteredHistory = historyEvents.filter((event) => {
    const q = searchTerm.toLowerCase()
    const matchesSearch =
      event.title.toLowerCase().includes(q) ||
      event.description.toLowerCase().includes(q) ||
      event.module.toLowerCase().includes(q)
    const matchesStatus = filterStatus === "all" || event.status === filterStatus
    return matchesSearch && matchesStatus
  })

  return (
    <div className="p-6 space-y-6 min-h-screen bg-background text-foreground">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Security History</h1>
          <p className="mt-2 text-slate-800 dark:text-muted-foreground">
            Audit trail and activity logs for all security operations
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => fetchScanHistory(currentPage)}
            variant="outline"
            size="sm"
            className="border-blue-600 text-blue-800 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-400/10"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <History className="h-8 w-8 text-blue-700 dark:text-blue-400" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/95 border-border dark:bg-gray-800/50 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-gray-400">Total Scans</p>
                <p className="text-2xl font-bold text-foreground">{total}</p>
              </div>
              <Search className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/95 border-border dark:bg-gray-800/50 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-gray-400">High Risk Found</p>
                <p className="text-2xl font-bold text-red-400">
                  {stats?.high_findings ??
                    (scanHistory || []).reduce((sum, scan) => sum + scan.high_risk_count, 0)}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/95 border-border dark:bg-gray-800/50 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-gray-400">Medium Risk Found</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {stats?.medium_findings ??
                    (scanHistory || []).reduce((sum, scan) => sum + scan.medium_risk_count, 0)}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/95 border-border dark:bg-gray-800/50 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-gray-400">Clean Scans</p>
                <p className="text-2xl font-bold text-green-400">
                  {stats?.clean_scans ??
                    (scanHistory || []).filter((scan) => scan.findings_count === 0).length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card/95 border-border dark:bg-gray-800/50 dark:border-gray-700">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-slate-600 dark:text-gray-400" />
                <Input
                  placeholder="Search history..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border-border bg-background pl-10 text-slate-900 placeholder:text-slate-500 dark:bg-gray-700/50 dark:border-gray-600 dark:text-white dark:placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full border-border bg-background text-slate-900 md:w-48 dark:bg-gray-700/50 dark:border-gray-600 dark:text-white">
                <SelectValue placeholder="Input channel" />
              </SelectTrigger>
              <SelectContent className="border-border">
                <SelectItem value="all">All channels</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="file">File</SelectItem>
                <SelectItem value="github">GitHub</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterModule} onValueChange={setFilterModule}>
              <SelectTrigger className="w-full border-border bg-background text-slate-900 md:w-56 dark:bg-gray-700/50 dark:border-gray-600 dark:text-white">
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent className="border-border max-h-72">
                <SelectItem value="all">All modules</SelectItem>
                <SelectItem value="code_scanning">Code / hybrid</SelectItem>
                <SelectItem value="prompt_injection">Prompt injection</SelectItem>
                <SelectItem value="data_poisoning">Data poisoning</SelectItem>
                <SelectItem value="vector_security">Vector / anomaly</SelectItem>
                <SelectItem value="embedding_inspection">Embedding inspection</SelectItem>
                <SelectItem value="retrieval_simulation">Retrieval attack</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full border-border bg-background text-slate-900 md:w-48 dark:bg-gray-700/50 dark:border-gray-600 dark:text-white">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="border-border">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="bg-red-900/20 border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card className="bg-card/95 border-border dark:bg-gray-800/50 dark:border-gray-700">
          <CardContent className="p-8">
            <div className="flex items-center justify-center space-x-2 text-slate-800 dark:text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Loading scan history...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History Timeline */}
      {!isLoading && !error && (
        <Card className="bg-card/95 border-border dark:bg-gray-800/50 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center space-x-2">
              <Clock className="w-5 h-5" />
              <span>Recent Activity</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {filteredHistory.length === 0 ? (
              <div className="py-8 text-center text-slate-800 dark:text-gray-400">
                <Search className="mx-auto mb-4 h-12 w-12 opacity-60 dark:opacity-50" />
                <p className="font-medium text-slate-900 dark:text-foreground">No scan history found</p>
                <p className="mt-1 text-sm text-slate-700 dark:text-gray-400">
                  Try performing a security scan to see results here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredHistory.map((event, index) => (
                  <div
                    key={event.id}
                    className="flex items-start space-x-4 rounded-lg border border-border bg-muted/50 p-4 transition-colors hover:bg-muted dark:border-transparent dark:bg-gray-700/30 dark:hover:bg-gray-700/50"
                  >
                    <div className={`p-2 rounded-full ${getStatusColor(event.status)}`}>
                      {getTypeIcon(event.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-foreground font-medium">{event.title}</h3>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(event.status)}
                          <span className="text-sm text-slate-600 dark:text-gray-400">
                            {format(event.timestamp, "MMM dd, yyyy 'at' HH:mm")}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1 text-slate-700 dark:text-muted-foreground">{event.description}</p>
                      <div className="flex items-center space-x-4 mt-2">
                        <Badge variant="outline" className="border-border text-xs text-slate-800 dark:border-gray-600 dark:text-gray-400">
                          {event.module}
                        </Badge>
                        {event.details && (
                          <div className="flex items-center space-x-2 text-xs text-slate-600 dark:text-gray-400">
                            {event.details.duration && (
                              <span>Duration: {event.details.duration}</span>
                            )}
                            {event.details.findings !== undefined && (
                              <span>• Findings: {event.details.findings}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <Button
            onClick={() => fetchScanHistory(currentPage - 1)}
            disabled={currentPage <= 1}
            variant="outline"
            size="sm"
            className="border-border text-slate-900 hover:bg-muted dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-slate-800 dark:text-gray-400">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            onClick={() => fetchScanHistory(currentPage + 1)}
            disabled={currentPage >= totalPages}
            variant="outline"
            size="sm"
            className="border-border text-slate-900 hover:bg-muted dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
