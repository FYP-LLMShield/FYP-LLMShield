"use client"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../contexts/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Switch } from "../ui/switch"
import { Slider } from "../ui/slider"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { Settings, User, Shield, Bell, Database, Save, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react"

export function SettingsPage() {
  const navigate = useNavigate()
  const { mfaStatus, fetchMfaStatus } = useAuth()
  const [settings, setSettings] = useState({
    // User Settings
    displayName: "Security Admin",
    email: "admin@company.com",
    password: "",
    newPassword: "",
    confirmPassword: "",
    currentPlan: "free",

    // Security Settings
    sessionTimeout: 30,
    mfaEnabled: false,
    twoFactorEnabled: mfaStatus?.enabled || false,
    passwordExpiry: 90,
    loginAttempts: 5,

    // Notification Settings
    emailAlerts: true,
    slackNotifications: false,
    criticalAlerts: true,
    weeklyReports: true,

    // Scan Settings
    defaultScanTimeout: 300,
    maxConcurrentScans: 3,
    autoScanEnabled: false,
    retentionDays: 90,

    // Thresholds
    promptInjectionThreshold: 25,
    anomalyThreshold: 75,
    riskScoreThreshold: 80,
  })

  const [selectedAvatar, setSelectedAvatar] = useState("robot")

  const avatarOptions = [
    { id: "robot", name: "Robot", emoji: "🤖" },
    { id: "shield", name: "Shield", emoji: "🛡️" },
    { id: "lock", name: "Lock", emoji: "🔒" },
    { id: "key", name: "Key", emoji: "🔑" },
    { id: "star", name: "Star", emoji: "⭐" },
    { id: "diamond", name: "Diamond", emoji: "💎" },
    { id: "crown", name: "Crown", emoji: "👑" },
    { id: "fire", name: "Fire", emoji: "🔥" },
  ]

  const plans = [
    {
      id: "free",
      name: "Free Plan",
      price: "$0/month",
      features: ["8 scans per month", "Basic security features", "Email support"],
      color: "from-gray-600 to-gray-700"
    },
    {
      id: "regular",
      name: "Regular Plan", 
      price: "$29/month",
      features: ["100 scans per month", "Advanced security features", "Priority support", "API access"],
      color: "from-blue-600 to-purple-600"
    },
    {
      id: "premium",
      name: "Premium Plan",
      price: "$99/month", 
      features: ["Unlimited scans", "All security features", "24/7 dedicated support", "Custom integrations"],
      color: "from-purple-600 to-pink-600"
    }
  ]

  const updateSetting = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  // Fetch MFA status on component mount
  useEffect(() => {
    fetchMfaStatus()
  }, [fetchMfaStatus])

  // Update local settings when MFA status changes
  useEffect(() => {
    if (mfaStatus) {
      setSettings(prev => ({ ...prev, twoFactorEnabled: mfaStatus.enabled }))
    }
  }, [mfaStatus])

  const saveSettings = () => {
    // Save settings logic here
    console.log("Saving settings:", settings)
  }

  const resetSettings = () => {
    // Reset to defaults
    console.log("Resetting settings to defaults")
  }

  return (
    <div className="p-6 space-y-6 min-h-screen" style={{backgroundColor: '#1d2736'}}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 mt-2">Configure your security dashboard preferences and system settings</p>
        </div>
        <div className="flex items-center space-x-2">
          <Settings className="w-8 h-8 text-blue-400" />
        </div>
      </div>

      <Tabs defaultValue="user" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
          <TabsTrigger value="user" className="data-[state=active]:bg-blue-600">
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="plans" className="data-[state=active]:bg-blue-600">
            <Settings className="w-4 h-4 mr-2" />
            Plans
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-blue-600">
            <Shield className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-blue-600">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="scanning" className="data-[state=active]:bg-blue-600">
            <Database className="w-4 h-4 mr-2" />
            Scanning
          </TabsTrigger>
          <TabsTrigger value="thresholds" className="data-[state=active]:bg-blue-600">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Thresholds
          </TabsTrigger>
        </TabsList>

        <TabsContent value="user" className="space-y-6">
          {/* Profile Photo Selection */}
          <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Profile Photo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
                {avatarOptions.map((avatar) => (
                  <button
                    key={avatar.id}
                    onClick={() => setSelectedAvatar(avatar.id)}
                    className={`p-4 rounded-xl text-2xl transition-all duration-200 ${
                      selectedAvatar === avatar.id
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg scale-110"
                        : "bg-white/10 hover:bg-white/20"
                    }`}
                  >
                    {avatar.emoji}
                  </button>
                ))}
              </div>
              <p className="text-gray-400 text-sm mt-4">Selected: {avatarOptions.find(a => a.id === selectedAvatar)?.name}</p>
            </CardContent>
          </Card>
