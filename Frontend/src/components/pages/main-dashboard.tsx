"use client"

import type React from "react"

import { useState, memo, useMemo } from "react"
import { Link } from "react-router-dom"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import WelcomePopup from "../welcome-popup"
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { CheckCircle, Eye, Pause, Shield, AlertTriangle, Database, Code } from "lucide-react"

// Sample data for charts
const threatTimelineData = [
  { time: "00:00", attacks: 45, blocked: 42, escaped: 3 },
  { time: "04:00", attacks: 32, blocked: 30, escaped: 2 },
  { time: "08:00", attacks: 78, blocked: 71, escaped: 7 },
  { time: "12:00", attacks: 156, blocked: 148, escaped: 8 },
  { time: "16:00", attacks: 203, blocked: 195, escaped: 8 },
  { time: "20:00", attacks: 134, blocked: 127, escaped: 7 },
]

const severityMixData = [
  { name: "Critical", value: 12, color: "#EF4444" },
  { name: "High", value: 34, color: "#F97316" },
  { name: "Medium", value: 89, color: "#EAB308" },
  { name: "Low", value: 156, color: "#22C55E" },
]

const guardrailCoverageData = [
  { name: "Prompt Filter", coverage: 95 },
  { name: "Output Sanitizer", coverage: 87 },
  { name: "Tool Validator", coverage: 92 },
  { name: "System Leak Blocker", coverage: 78 },
]

const recentAlerts = [
  {
    id: "ALT-2024-001",
    severity: "Critical",
    type: "Prompt Injection",
    description: "SQL injection attempt detected",
    time: "2 min ago",
    status: "Open",
  },
  {
    id: "ALT-2024-002",
    severity: "High",
    type: "Model Poisoning",
    description: "Anomalous behavior in GPT-4 responses",
    time: "15 min ago",
    status: "Investigating",
  },
  {
    id: "ALT-2024-003",
    severity: "Medium",
    type: "Data Poisoning",
    description: "Suspicious document embeddings",
    time: "1 hour ago",
    status: "Assigned",
  },
  {
    id: "ALT-2024-004",
    severity: "High",
    type: "Code Scanning",
    description: "Buffer overflow vulnerability found",
    time: "2 hours ago",
    status: "Resolved",
  },
]

const recentScans = [
  {
    id: "SCN-2024-045",
    type: "Full Security Scan",
    target: "Production API",
    findings: 23,
    duration: "12m 34s",
    status: "Completed",
  },
  {
    id: "SCN-2024-044",
    type: "Code Analysis",
    target: "auth-service",
    findings: 7,
    duration: "3m 12s",
    status: "Completed",
  },
  {
    id: "SCN-2024-043",
    type: "Vector Analysis",
    target: "knowledge-base",
    findings: 156,
    duration: "45m 21s",
    status: "Running",
  },
  {
    id: "SCN-2024-042",
    type: "Prompt Testing",
    target: "chat-model",
    findings: 12,
    duration: "8m 45s",
    status: "Completed",
  },
]

export const MainDashboard = memo(() => {
  const [showWelcomePopup, setShowWelcomePopup] = useState(() => {
    const hasSeenWelcome = sessionStorage.getItem('welcomePopupShown');
    return !hasSeenWelcome;
  });

  const handleCloseWelcome = () => {
    setShowWelcomePopup(false);
    sessionStorage.setItem('welcomePopupShown', 'true');
  };
