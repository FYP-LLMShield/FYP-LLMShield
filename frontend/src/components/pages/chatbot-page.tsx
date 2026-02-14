import { useState, useRef, useEffect } from "react"
import { useAuth } from "../../contexts/AuthContext"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { ScrollArea } from "../ui/scroll-area"
import {
  Send,
  Plus,
  MessageCircle,
  Loader,
  Copy,
  Check,
  Sparkles,
  Clock,
  Zap,
  Shield,
} from "lucide-react"
import axios from "axios"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  sources?: string[]
}

interface Session {
  session_id: string
  started_at: string
  message_count: number
}

export function ChatbotPage() {
  const { user, token } = useAuth()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [showSessions, setShowSessions] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const API_BASE = "http://localhost:8000/api/v1/chat"

  // Initialize chatbot
  useEffect(() => {
    if (user?.email && token) {
      createNewSession()
      loadSessions()
    }
  }, [user?.email, token])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const createNewSession = async () => {
    try {
      const response = await axios.post(
        `${API_BASE}/session`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      setSessionId(response.data.session_id)
      setMessages([])
      setInput("")
    } catch (error) {
      console.error("Error creating session:", error)
    }
  }

  const loadSessions = async () => {
    try {
      const response = await axios.get(`${API_BASE}/sessions?limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setSessions(response.data.sessions)
    } catch (error) {
      console.error("Error loading sessions:", error)
    }
  }

  const switchSession = async (newSessionId: string) => {
    try {
      const response = await axios.get(
        `${API_BASE}/history/${newSessionId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      setSessionId(newSessionId)
      setMessages(
        response.data.messages.map((msg: any, idx: number) => ({
          id: idx.toString(),
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          sources: msg.sources,
        }))
      )
      setShowSessions(false)
    } catch (error) {
      console.error("Error switching session:", error)
    }
  }

  const handleSendMessage = async () => {
    if (!input.trim() || !sessionId || !token) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    const currentInput = input
    setInput("")
    setIsLoading(true)

    try {
      const response = await axios.post(
        `${API_BASE}/chat`,
        {
          message: currentInput,
          session_id: sessionId,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.data.response,
        timestamp: response.data.timestamp,
        sources: response.data.sources,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error("Error sending message:", error)
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content:
          "Sorry, I encountered an error. Please check your backend connection.",
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6 p-8 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Sidebar - Sessions */}
      <div className="w-64 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-purple-400" />
            Chats
          </h2>
          <Button
            onClick={createNewSession}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-2">
            {sessions.map((session) => (
              <button
                key={session.session_id}
                onClick={() => switchSession(session.session_id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ${
                  sessionId === session.session_id
                    ? "bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/20"
                    : "bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-3 h-3" />
                  <span className="text-sm font-medium truncate">
                    {new Date(session.started_at).toLocaleDateString()}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {session.message_count} messages
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl backdrop-blur-xl">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-purple-400" />
              Security Assistant
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Ask me about your security scans, findings, and best practices
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 bg-gradient-to-b from-purple-900/20 to-slate-900/20 border border-purple-500/10 rounded-2xl overflow-hidden flex flex-col backdrop-blur-sm">
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-4 pr-4">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center py-12">
                  <Sparkles className="w-16 h-16 text-purple-400/30 mb-4" />
                  <h2 className="text-xl font-semibold text-gray-300 mb-2">
                    Welcome to Security Assistant
                  </h2>
                  <p className="text-gray-500 max-w-sm">
                    I can help you understand your security scan results, explain findings, and answer questions about security best practices.
                  </p>
                  <div className="mt-8 grid grid-cols-2 gap-3">
                    {[
                      { icon: Shield, label: "Explain a finding" },
                      { icon: Zap, label: "Security tips" },
                    ].map((item) => (
                      <button
                        key={item.label}
                        onClick={() =>
                          setInput(`Can you help me understand ${item.label}?`)
                        }
                        className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 rounded-lg text-sm text-purple-300 transition-all duration-200 flex items-center gap-2 justify-center"
                      >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  } animate-fadeIn`}
                >
                  <div
                    className={`max-w-sm lg:max-w-md xl:max-w-lg px-6 py-4 rounded-2xl ${
                      message.role === "user"
                        ? "bg-gradient-to-br from-purple-600 to-purple-500 text-white rounded-br-none shadow-lg shadow-purple-500/20"
                        : "bg-gradient-to-br from-slate-700/50 to-slate-600/50 text-gray-100 border border-slate-500/20 rounded-bl-none"
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{message.content}</p>

                    {/* Sources */}
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <p className="text-xs text-gray-300 mb-2">
                          📎 Sources:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {message.sources.map((source) => (
                            <span
                              key={source}
                              className="text-xs px-2 py-1 bg-white/10 rounded text-gray-300"
                            >
                              {source}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Copy Button */}
                    <button
                      onClick={() => copyToClipboard(message.content, message.id)}
                      className="mt-2 text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1 transition-colors"
                    >
                      {copiedId === message.id ? (
                        <>
                          <Check className="w-3 h-3" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}

              {/* Typing Indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gradient-to-br from-slate-700/50 to-slate-600/50 px-6 py-4 rounded-2xl rounded-bl-none">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                      <div
                        className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      />
                      <div
                        className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Input Area */}
        <div className="flex gap-3 p-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl backdrop-blur-xl">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) =>
              e.key === "Enter" && !e.shiftKey && handleSendMessage()
            }
            placeholder="Ask me anything about your security scans..."
            disabled={isLoading || !sessionId}
            className="bg-white/10 border-purple-500/30 text-white placeholder-gray-400 focus:border-purple-500/60 focus:ring-purple-500/20"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim() || !sessionId}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6"
          >
            {isLoading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
