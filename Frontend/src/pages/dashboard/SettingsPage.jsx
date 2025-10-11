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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-4 border border-purple-700/60"
        >
          <nav className="space-y-2">
            {sections.map((section) => {
              const IconComponent = section.icon
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    activeSection === section.id
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                : "text-gray-300 hover:bg-gradient-to-r hover:from-purple-800/80 hover:to-pink-800/60 hover:text-white"
                  }`}
                >
                  <IconComponent className="h-5 w-5" />
                  <span className="font-medium">{section.label}</span>
                </button>
              )
            })}
          </nav>
        </motion.div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Profile Settings */}
          {activeSection === "profile" && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60"
            >
              <h3 className="text-xl font-bold text-white mb-6">Update Profile</h3>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">Display Name</label>
                    <input
                      type="text"
                      defaultValue="John Doe"
                      className="w-full bg-gradient-to-r from-purple-800/80 to-pink-800/60 border border-purple-600/70 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">Email</label>
                    <input
                      type="email"
                      defaultValue="john.doe@example.com"
                      className="w-full bg-gradient-to-r from-purple-800/80 to-pink-800/60 border border-purple-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Change Password</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="password"
                      placeholder="Current Password"
                      className="w-full bg-gradient-to-r from-purple-800/80 to-pink-800/60 border border-purple-600/70 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <input
                      type="password"
                      placeholder="New Password"
                      className="w-full bg-gradient-to-r from-purple-800/80 to-pink-800/60 border border-purple-700 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors">
                  Save Changes
                </button>
              </div>
            </motion.div>
          )}

          {/* Billing Settings */}
          {activeSection === "billing" && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60">
                <h3 className="text-xl font-bold text-white mb-6">Upgrade Account</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {plans.map((plan) => (
                    <div
                      key={plan.name}
                      className={`border rounded-lg p-6 ${
                        plan.current ? "border-green-500 bg-green-900/20" : "border-purple-600/70 bg-gradient-to-br from-purple-800/60 to-pink-800/40"
                      }`}
                    >
                      <div className="text-center mb-4">
                        <h4 className="text-lg font-bold text-white">{plan.name}</h4>
                        <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mt-2">
                          {plan.price}
                          {plan.price !== "$0" && <span className="text-sm text-gray-400">/month</span>}
                        </div>
                      </div>

                      <ul className="space-y-2 mb-6">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="text-gray-300 text-sm flex items-center">
                            <Check className="h-4 w-4 text-green-400 mr-2" />
                            {feature}
                          </li>
                        ))}
                      </ul>

                      <button
                        className={`w-full py-2 px-4 rounded-lg transition-colors ${
                          plan.current
                            ? "bg-green-600 text-white cursor-default"
                            : "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                        }`}
                        disabled={plan.current}
                      >
                        {plan.current ? "Current Plan" : "Upgrade"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Security Settings */}
          {activeSection === "security" && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60"
            >
              <h3 className="text-xl font-bold text-white mb-6">Security & MFA</h3>

              <div className="space-y-6">
                <Link 
                  to="/dashboard/mfa"
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-lg hover:from-purple-700/80 hover:to-pink-700/60 transition-all duration-200 group"
                >
                  <div>
                    <h4 className="text-white font-medium">Two-Factor Authentication</h4>
                    <p className="text-gray-400 text-sm">Manage MFA settings and recovery codes</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                </Link>

                <div className="space-y-3">
                  <h4 className="text-white font-medium">Login Sessions</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-lg">
                      <div>
                        <p className="text-white text-sm">Current Session - Chrome on Windows</p>
                        <p className="text-gray-400 text-xs">San Francisco, CA • Active now</p>
                      </div>
                      <span className="text-green-400 text-xs">Current</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-lg">
                      <div>
                        <p className="text-white text-sm">Mobile App - iPhone</p>
                        <p className="text-gray-400 text-xs">San Francisco, CA • 2 hours ago</p>
                      </div>
                      <button className="text-red-400 text-xs hover:text-red-300">Revoke</button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* API Keys */}
          {activeSection === "api" && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">API Key Management</h3>
                <button
                  onClick={() => setShowNewKeyForm(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Key</span>
                </button>
              </div>

              {/* Add New Key Form */}
              {showNewKeyForm && (
                <div className="bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-lg p-4 mb-6">
                  <h4 className="text-white font-medium mb-4">Add New API Key</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="text"
                      placeholder="Key Name"
                      value={newKeyData.name}
                      onChange={(e) => setNewKeyData((prev) => ({ ...prev, name: e.target.value }))}
                      className="bg-gradient-to-r from-purple-700/80 to-pink-700/60 border border-purple-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <select
                      value={newKeyData.type}
                      onChange={(e) => setNewKeyData((prev) => ({ ...prev, type: e.target.value }))}
                      className="bg-gradient-to-r from-purple-700/80 to-pink-700/60 border border-purple-600 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="OpenAI">OpenAI</option>
                      <option value="Vector DB">Vector DB</option>
                      <option value="Hugging Face">Hugging Face</option>
                      <option value="Other">Other</option>
                    </select>
                    <input
                      type="password"
                      placeholder="API Key"
                      value={newKeyData.key}
                      onChange={(e) => setNewKeyData((prev) => ({ ...prev, key: e.target.value }))}
                      className="bg-gradient-to-r from-purple-700/80 to-pink-700/60 border border-purple-600 rounded-lg p-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex space-x-3 mt-4">
                    <button
                      onClick={addApiKey}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Add Key
                    </button>
                    <button
                      onClick={() => setShowNewKeyForm(false)}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* API Keys List */}
              <div className="space-y-3">
                {apiKeys.map((apiKey) => (
                  <div key={apiKey.id} className="bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="text-white font-medium">{apiKey.name}</h4>
                          <span className="px-2 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-purple-200 rounded text-xs">{apiKey.type}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <code className="text-gray-300 text-sm font-mono">
                            {apiKey.key.substring(0, 8)}...{apiKey.key.slice(-4)}
                          </code>
                          <button
                            onClick={() => copyToClipboard(apiKey.key, apiKey.id)}
                            className="text-purple-400 hover:text-purple-300 transition-colors"
                          >
                            {copiedKey === apiKey.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className="text-gray-400 text-xs mt-1">Created: {apiKey.created}</p>
                      </div>
                      <button
                        onClick={() => removeApiKey(apiKey.id)}
                        className="text-red-400 hover:text-red-300 p-2 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsPage



