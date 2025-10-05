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



  const memoizedThreatData = useMemo(() => threatTimelineData, []);
  const memoizedSeverityData = useMemo(() => severityMixData, []);
  const memoizedGuardrailData = useMemo(() => guardrailCoverageData, []);

  return (
    // No changes needed here. The popup will portal itself out correctly.
    <div className="p-8 scroll-container min-h-screen" style={{backgroundColor: '#1d2736'}}>
      <WelcomePopup 
        isOpen={showWelcomePopup} 
        onClose={handleCloseWelcome}
        userName="Security Admin"
      />
      
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Security Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <HeroCard
            title="Prompt Injection"
            accent="purple"
            href="/dashboard/prompt-injection"
            artSrc="/art/prompt.png"
            icon={Shield}
            kpis={[
              { label: "Attempts (24h)", value: "1,247" },
              { label: "Blocked", value: "1,198" },
              { label: "Escaped", value: "49" },
            ]}
          />
          <HeroCard
            title="Model Poisoning"
            accent="red"
            href="/dashboard/model-poisoning"
            artSrc="/art/model.png"
            icon={AlertTriangle}
            kpis={[
              { label: "Suspected Models", value: "3" },
              { label: "Incidents", value: "12" },
            ]}
          />
          <HeroCard
            title="Vector Embedding"
            accent="teal"
            href="/dashboard/vector-embedding"
            artSrc="/art/vector.png"
            icon={Database}
            kpis={[
              { label: "Hit-Rate", value: "94.2%" },
              { label: "Drift", value: "0.03" },
              { label: "Duplicates", value: "127" },
            ]}
          />
          <HeroCard
            title="C/C++ Code Scanning"
            accent="yellow"
            href="/dashboard/code-scanning"
            artSrc="/art/code.png"
            icon={Code}
            kpis={[
              { label: "Sev1/2/3", value: "45/123/89" },
              { label: "Files Scanned", value: "2,847" },
            ]}
          />
        </div>


        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <KPICard title="Overall Risk Score" value="73" type="ring" color="orange" />
          <KPICard title="Open Alerts (Sev1)" value="12" color="red" />
          <KPICard title="Open Alerts (Sev2)" value="34" color="yellow" />
          <KPICard title="Latency p95" value="245ms" color="green" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 glass-card border-blue-500/30 shadow-blue-500/20 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Threat Timeline (24h)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={memoizedThreatData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1F2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#F9FAFB",
                  }}
                />
                <Area type="monotone" dataKey="attacks" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.3} />
                <Area type="monotone" dataKey="blocked" stackId="2" stroke="#22C55E" fill="#22C55E" fillOpacity={0.3} />
                <Area type="monotone" dataKey="escaped" stackId="3" stroke="#F97316" fill="#F97316" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card border-orange-500/30 shadow-orange-500/20 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Severity Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={memoizedSeverityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {memoizedSeverityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1F2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#F9FAFB",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {memoizedSeverityData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-gray-300 text-sm">{item.name}</span>
                  </div>
                  <span className="text-white font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>


        <div className="glass-card border-green-500/30 shadow-green-500/20 p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Guardrail Coverage</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={memoizedGuardrailData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1F2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  color: "#F9FAFB",
                }}
              />
              <Bar dataKey="coverage" fill="#22C55E" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card border-red-500/30 shadow-red-500/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Recent Alerts</h3>
              <Button variant="outline" size="sm">
                View All
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-gray-400">ID</TableHead>
                  <TableHead className="text-gray-400">Type</TableHead>
                  <TableHead className="text-gray-400">Severity</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAlerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell className="text-white font-mono text-sm">{alert.id}</TableCell>
                    <TableCell className="text-gray-300">{alert.type}</TableCell>
                    <TableCell>
                      <Badge
                        variant={alert.severity === "Critical" ? "destructive" : alert.severity === "High" ? "secondary" : "outline"}
                      >
                        {alert.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {alert.status === "Open" && <div className="w-2 h-2 bg-red-500 rounded-full" />}
                        {alert.status === "Investigating" && <div className="w-2 h-2 bg-yellow-500 rounded-full" />}
                        {alert.status === "Assigned" && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                        {alert.status === "Resolved" && <CheckCircle size={16} className="text-green-500" />}
                        <span className="text-gray-300 text-sm">{alert.status}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>



          <div className="glass-card border-blue-500/30 shadow-blue-500/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Recent Scans</h3>
              <Button variant="outline" size="sm">
                <Eye size={16} className="mr-2" />
                View All
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-gray-400">ID</TableHead>
                  <TableHead className="text-gray-400">Type</TableHead>
                  <TableHead className="text-gray-400">Findings</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentScans.map((scan) => (
                  <TableRow key={scan.id}>
                    <TableCell className="text-white font-mono text-sm">{scan.id}</TableCell>
                    <TableCell className="text-gray-300">{scan.type}</TableCell>
                    <TableCell className="text-white font-medium">{scan.findings}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {scan.status === "Completed" && <CheckCircle size={16} className="text-green-500" />}
                        {scan.status === "Running" && <Pause size={16} className="text-yellow-500" />}
                        <span className="text-gray-300 text-sm">{scan.status}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
});

// ... (HeroCard and KPICard components remain the same)
interface HeroCardProps {
  title: string
  accent: "purple" | "red" | "teal" | "yellow"
  href: string
  artSrc: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  kpis: { label: string; value: string }[]
}

function HeroCard({ title, accent, href, artSrc, icon: Icon, kpis }: HeroCardProps) {
  const accentColors = {
    purple: "border-4 border-purple-200 shadow-[#4C1D95]/50",
    red: "border-4 border-red-200 shadow-[#7F1D1D]/50",
    teal: "border-2 border-teal-200 shadow-[#134E4A]/50",
    yellow: "<border-2></border-2> border-yellow-200 shadow-[#713F12]/50",
  }

  const glowColors = {
    purple: "#4C1D95",
    red: "#7F1D1D", 
    teal: "#134E4A",
    yellow: "#713F12",
  }

  return (
    <Link to={href}>
      <div
        className={`glass-card p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-current/50 hover:scale-105 relative overflow-hidden h-56 flex flex-col group`}
        style={{
           border: accent === 'purple' ? '2px solid #a855f7' :
                  accent === 'red' ? '2px solid #f87171' :
                  accent === 'teal' ? '2px solid #2dd4bf' :
                  '2px solid #facc15'
         }}
      >
        <div
          className="absolute inset-0 opacity-30 bg-cover bg-center group-hover:opacity-40 transition-opacity duration-300"
          style={{
            backgroundImage: `url(${artSrc})`,
            mixBlendMode: "overlay",
            filter: "blur(1px)",
          }}
        />
