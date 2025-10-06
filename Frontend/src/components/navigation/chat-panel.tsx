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

export function ChatPanel({ open, width, onToggle, onResize }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "assistant",
      content: "Hello! I'm your AI security assistant. How can I help you today?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const resizeRef = useRef<HTMLDivElement>(null)
  const [isResizing, setIsResizing] = useState(false)

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    const currentInput = input
    setInput("")
    setIsTyping(true)

    setTimeout(() => {
      const response =
        faqAnswers[currentInput] ||
        `I understand you're asking about "${currentInput}". This appears to be related to security analysis. Let me help you with that...`

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: response,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsTyping(false)
    }, 1500)
  }

  const handleChipClick = (chip: string) => {
    setInput(chip)
  }

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const exportChat = () => {
    const chatData = {
      messages,
      timestamp: new Date().toISOString(),
      user: "Security Admin",
    }
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `chat-export-${Date.now()}.json`
    a.click()
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      const newWidth = window.innerWidth - e.clientX
      onResize(Math.max(300, Math.min(600, newWidth)))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizing, onResize])

  if (!open) {
    return (
      <Button
        onClick={onToggle}
        className="fixed right-4 bottom-4 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg"
      >
        <MessageCircle size={24} />
      </Button>
    )
  }


  return (
    <div
      className="bg-white/5 backdrop-blur-md rounded-l-3xl border-l border-white/10 flex flex-col h-full"
      style={{
        width: `${width}px`,
        background: `linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)`,
      }}
    >
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-white font-semibold">AI Assistant</h3>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" onClick={exportChat} className="text-gray-400 hover:text-white">
            <Download size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onToggle} className="text-gray-400 hover:text-white">
            <X size={16} />
          </Button>
        </div>
      </div>

      <div className="p-4 border-b border-white/10">
        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
          {faqChips.map((chip) => (
            <Button
              key={chip}
              variant="outline"
              size="sm"
              onClick={() => handleChipClick(chip)}
              className="text-xs bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 justify-start text-left h-auto py-2 px-3"
            >
              {chip}
            </Button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] p-3 rounded-lg group relative ${
                  message.type === "user" ? "bg-blue-600 text-white" : "bg-white/10 text-gray-100"
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <p className="text-xs opacity-70 mt-1">{message.timestamp.toLocaleTimeString()}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyMessage(message.content)}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto"
                >
                  <Copy size={12} />
                </Button>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white/10 text-gray-100 p-3 rounded-lg">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-white/10">
        <div className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about security findings..."
            className="bg-white/5 border-white/10 text-white placeholder-gray-400"
          />
          <Button onClick={handleSend} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}
