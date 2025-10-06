"use client"
import { useState } from "react"
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
} from "lucide-react"
import { format } from "date-fns"

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


  const filteredHistory = mockHistory.filter((event) => {
    const matchesSearch =
      event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === "all" || event.type === filterType
    const matchesStatus = filterStatus === "all" || event.status === filterStatus
    return matchesSearch && matchesType && matchesStatus
  })

  return (
    <div className="p-6 space-y-6 min-h-screen" style={{backgroundColor: '#1d2736'}}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Security History</h1>
          <p className="text-gray-400 mt-2">Audit trail and activity logs for all security operations</p>
        </div>
        <div className="flex items-center space-x-2">
          <History className="w-8 h-8 text-blue-400" />
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search history..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="scan">Scans</SelectItem>
                <SelectItem value="alert">Alerts</SelectItem>
                <SelectItem value="action">Actions</SelectItem>
                <SelectItem value="login">Logins</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
