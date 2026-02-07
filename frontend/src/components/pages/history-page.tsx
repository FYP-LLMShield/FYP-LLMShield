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
import { scanHistoryAPI } from "../../lib/api"

interface ScanHistoryItem {
  id: string
  scan_id: string
  input_type: string
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

const mockHistory: HistoryEvent[] = [
  {
    id: "1",
    type: "scan",
    title: "Prompt Injection Scan Completed",
    description: "Comprehensive scan found 3 critical vulnerabilities",
    timestamp: new Date(2024, 0, 15, 14, 30),
    user: "admin@company.com",
    status: "warning",
    module: "Prompt Injection",
    details: { vulnerabilities: 3, duration: "2m 45s" },
  },
  {
    id: "2",
    type: "alert",
    title: "High Severity Alert Triggered",
    description: "Buffer overflow detected in main.cpp",
    timestamp: new Date(2024, 0, 15, 13, 15),
    user: "system",
    status: "error",
    module: "Code Scanning",
    details: { severity: "High", file: "main.cpp", line: 45 },
  },
  {
    id: "3",
    type: "action",
    title: "Security Rule Updated",
    description: "Modified prompt injection detection threshold",
    timestamp: new Date(2024, 0, 15, 12, 0),
    user: "security@company.com",
    status: "success",
    module: "Settings",
    details: { threshold: "25%" },
  },
  {
    id: "4",
    type: "scan",
    title: "Vector Embedding Health Check",
    description: "All embeddings passed health validation",
    timestamp: new Date(2024, 0, 15, 10, 45),
    user: "admin@company.com",
    status: "success",
    module: "Vector Embedding",
    details: { embeddings: 1247, passed: 1247 },
  },
  {
    id: "5",
    type: "login",
    title: "User Login",
    description: "Successful authentication from 192.168.1.100",
    timestamp: new Date(2024, 0, 15, 9, 30),
    user: "admin@company.com",
    status: "info",
    module: "Authentication",
    details: { ip: "192.168.1.100", location: "San Francisco, CA" },
  },
]

export function HistoryPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [dateRange, setDateRange] = useState<Date | undefined>(new Date())
  
  // New state for real scan history data
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Fetch scan history data
  const fetchScanHistory = async (page: number = 1) => {
    try {
      setIsLoading(true)
      setError(null)
      
      const inputType = filterType === "all" ? undefined : filterType
      const response = await scanHistoryAPI.getHistory(page, 20, inputType)
      
      if (response.success && response.data) {
        setScanHistory(response.data.scans)
        setTotalPages(response.data.total_pages)
        setTotal(response.data.total)
        setCurrentPage(response.data.page)
      } else {
        setError(response.error || "Failed to fetch scan history")
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
  }, [filterType])

  // Convert scan history to display format
  const convertScanToHistoryEvent = (scan: ScanHistoryItem): HistoryEvent => {
    const status = scan.high_risk_count > 0 ? "error" : 
                  scan.medium_risk_count > 0 ? "warning" : "success"
    
    const inputTypeDisplay = scan.input_type === "text" ? "Text Scan" :
                            scan.input_type === "file" ? "File Scan" :
                            scan.input_type === "github" ? "GitHub Scan" : "Scan"
    
    const description = scan.findings_count > 0 
      ? `Found ${scan.findings_count} findings (${scan.high_risk_count} high, ${scan.medium_risk_count} medium, ${scan.low_risk_count} low risk)`
      : "No security issues found"

    return {
      id: scan.id,
      type: "scan",
      title: `${inputTypeDisplay} Completed`,
      description,
      timestamp: new Date(scan.created_at),
      user: "current_user", // We could get this from auth context
      status,
      module: inputTypeDisplay,
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
    const matchesSearch =
      event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === "all" || event.status === filterStatus
    return matchesSearch && matchesStatus
  })

  return (
    <div className="p-6 space-y-6 min-h-screen" style={{backgroundColor: '#1d2736'}}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Security History</h1>
          <p className="text-gray-400 mt-2">Audit trail and activity logs for all security operations</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => fetchScanHistory(currentPage)}
            variant="outline"
            size="sm"
            className="text-blue-400 border-blue-400 hover:bg-blue-400/10"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <History className="w-8 h-8 text-blue-400" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Scans</p>
                <p className="text-2xl font-bold text-white">{total}</p>
              </div>
              <Search className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">High Risk Found</p>
                <p className="text-2xl font-bold text-red-400">
                  {(scanHistory || []).reduce((sum, scan) => sum + scan.high_risk_count, 0)}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Medium Risk Found</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {(scanHistory || []).reduce((sum, scan) => sum + scan.medium_risk_count, 0)}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Clean Scans</p>
                <p className="text-2xl font-bold text-green-400">
                  {(scanHistory || []).filter(scan => scan.findings_count === 0).length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search history..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-48 bg-gray-700/50 border-gray-600 text-white">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="text">Text Scans</SelectItem>
                <SelectItem value="file">File Scans</SelectItem>
                <SelectItem value="github">GitHub Scans</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-48 bg-gray-700/50 border-gray-600 text-white">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
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
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="p-8">
            <div className="flex items-center justify-center space-x-2 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Loading scan history...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History Timeline */}
      {!isLoading && !error && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <Clock className="w-5 h-5" />
              <span>Recent Activity</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {filteredHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No scan history found</p>
                <p className="text-sm">Try performing a security scan to see results here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredHistory.map((event, index) => (
                  <div key={event.id} className="flex items-start space-x-4 p-4 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 transition-colors">
                    <div className={`p-2 rounded-full ${getStatusColor(event.status)}`}>
                      {getTypeIcon(event.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-white font-medium">{event.title}</h3>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(event.status)}
                          <span className="text-sm text-gray-400">
                            {format(event.timestamp, "MMM dd, yyyy 'at' HH:mm")}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-300 mt-1">{event.description}</p>
                      <div className="flex items-center space-x-4 mt-2">
                        <Badge variant="outline" className="text-xs border-gray-600 text-gray-400">
                          {event.module}
                        </Badge>
                        {event.details && (
                          <div className="flex items-center space-x-2 text-xs text-gray-400">
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
            className="text-gray-400 border-gray-600 hover:bg-gray-700"
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-gray-400">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            onClick={() => fetchScanHistory(currentPage + 1)}
            disabled={currentPage >= totalPages}
            variant="outline"
            size="sm"
            className="text-gray-400 border-gray-600 hover:bg-gray-700"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
