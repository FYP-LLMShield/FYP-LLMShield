import { useState } from "react"
import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import { Settings, User, CreditCard, Shield, Key, Plus, Trash2, Copy, Check, ArrowRight } from "lucide-react"

const SettingsPage = () => {
  const [activeSection, setActiveSection] = useState("profile")
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [apiKeys, setApiKeys] = useState([
    { id: 1, name: "OpenAI GPT-4", key: "sk-...abc123", type: "OpenAI", created: "2024-01-15" },
    { id: 2, name: "Pinecone Vector DB", key: "pc-...def456", type: "Vector DB", created: "2024-01-20" },
  ])
  const [showNewKeyForm, setShowNewKeyForm] = useState(false)
  const [newKeyData, setNewKeyData] = useState({ name: "", key: "", type: "OpenAI" })
  const [copiedKey, setCopiedKey] = useState(null)

  const sections = [
    { id: "profile", label: "Update Profile", icon: User },
    { id: "billing", label: "Upgrade Account", icon: CreditCard },
    { id: "security", label: "Security & MFA", icon: Shield },
    { id: "api", label: "API Keys", icon: Key },
  ]

  const plans = [
    {
      name: "Free",
      price: "$0",
      features: ["Basic scans", "1 scan/day", "No chatbot"],
      current: true,
    },
    {
      name: "Plus",
      price: "$15",
      features: ["More scans", "Chatbot access", "Priority support"],
      current: false,
    },
    {
      name: "Pro",
      price: "$20",
      features: ["Unlimited scans", "Advanced analytics", "API integration"],
      current: false,
    },
  ]

  const addApiKey = () => {
    if (newKeyData.name && newKeyData.key) {
      setApiKeys((prev) => [
        ...prev,
        {
          id: Date.now(),
          name: newKeyData.name,
          key: newKeyData.key,
          type: newKeyData.type,
          created: new Date().toISOString().split("T")[0],
        },
      ])
      setNewKeyData({ name: "", key: "", type: "OpenAI" })
      setShowNewKeyForm(false)
    }
  }

  const removeApiKey = (id) => {
    setApiKeys((prev) => prev.filter((key) => key.id !== id))
  }

  const copyToClipboard = (text, keyId) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(keyId)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60"
      >
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg">
            <Settings className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-gray-300">Manage your account preferences and security settings</p>
          </div>
        </div>
      </motion.div>
