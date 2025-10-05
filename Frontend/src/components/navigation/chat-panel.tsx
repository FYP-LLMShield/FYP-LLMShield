import { useState, useRef, useEffect } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { ScrollArea } from "../ui/scroll-area"
import { MessageCircle, X, Send, Download, Copy } from "lucide-react"

interface ChatPanelProps {
  open: boolean
  width: number
  onToggle: () => void
  onResize: (width: number) => void
}

interface Message {
  id: string
  type: "user" | "assistant"
  content: string
  timestamp: Date
}

const faqChips = [
  "Explain this finding",
  "Quarantine docs?",
  "What is drift?",
  "How to reduce false positives?",
  "What are prompt injections?",
  "How to improve model security?",
  "Vector embedding best practices",
  "Code scanning configuration",
  "Alert severity levels",
  "Security policy setup",
  "Incident response workflow",
  "Performance optimization tips",
]

const faqAnswers: Record<string, string> = {
  "Explain this finding":
    "This security finding indicates a potential vulnerability or anomaly detected in your system. I can help analyze the specific details and recommend appropriate remediation steps.",
  "Quarantine docs?":
    "Document quarantine isolates suspicious files to prevent potential security risks. You can quarantine documents from the Vector Store Anomaly Detection page or through automated policies.",
  "What is drift?":
    "Drift refers to changes in your model's behavior or data patterns over time. It's measured by comparing current performance against baseline metrics and can indicate model degradation or data quality issues.",
  "How to reduce false positives?":
    "To reduce false positives: 1) Adjust detection thresholds, 2) Improve training data quality, 3) Fine-tune model parameters, 4) Implement better filtering rules, 5) Regular model retraining with updated data.",
  "What are prompt injections?":
    "Prompt injections are attacks where malicious input is crafted to manipulate AI model behavior, potentially causing it to ignore safety guidelines or reveal sensitive information.",
  "How to improve model security?":
    "Improve model security by: implementing input validation, using output filtering, regular security audits, access controls, monitoring for anomalies, and keeping models updated.",
  "Vector embedding best practices":
    "Best practices include: regular drift monitoring, proper chunking strategies, maintaining embedding quality, implementing deduplication, and monitoring for anomalous vectors.",
  "Code scanning configuration":
    "Configure code scanning by setting appropriate severity thresholds, selecting relevant rule sets, defining scan schedules, and customizing detection patterns for your codebase.",
  "Alert severity levels":
    "Severity levels: Critical (immediate action required), High (urgent attention needed), Medium (should be addressed soon), Low (informational or minor issues).",
  "Security policy setup":
    "Set up security policies by defining access controls, establishing monitoring rules, configuring alert thresholds, and implementing automated response procedures.",
  "Incident response workflow":
    "Incident response workflow: 1) Detection and analysis, 2) Containment and eradication, 3) Recovery and post-incident analysis, 4) Documentation and lessons learned.",
  "Performance optimization tips":
    "Optimize performance by: tuning detection thresholds, implementing efficient caching, optimizing query patterns, regular maintenance, and monitoring resource usage.",
}
