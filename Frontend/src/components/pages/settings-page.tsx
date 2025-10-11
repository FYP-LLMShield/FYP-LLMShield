"use client"
import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
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
  const location = useLocation()
  const { mfaStatus, fetchMfaStatus } = useAuth()
  
  // Handle active tab from navigation state
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || "user")
  
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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

          {/* User Profile Information */}
          <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">Display Name</Label>
                  <Input
                    value={settings.displayName}
                    onChange={(e) => updateSetting("displayName", e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Email</Label>
                  <Input
                    value={settings.email}
                    onChange={(e) => updateSetting("email", e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Password Change */}
          <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Change Password</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-300">Current Password</Label>
                <Input
                  type="password"
                  value={settings.password}
                  onChange={(e) => updateSetting("password", e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="Enter current password"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">New Password</Label>
                  <Input
                    type="password"
                    value={settings.newPassword}
                    onChange={(e) => updateSetting("newPassword", e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                    placeholder="Enter new password"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Confirm New Password</Label>
                  <Input
                    type="password"
                    value={settings.confirmPassword}
                    onChange={(e) => updateSetting("confirmPassword", e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                Update Password
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Subscription Plans</CardTitle>
              <p className="text-gray-400">Choose the plan that best fits your needs</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`relative p-6 rounded-2xl border transition-all duration-200 ${
                      settings.currentPlan === plan.id
                        ? "border-blue-500 bg-gradient-to-br from-blue-900/30 to-purple-900/30"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    {settings.currentPlan === plan.id && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                          Current Plan
                        </span>
                      </div>
                    )}
                    
                    <div className="text-center mb-4">
                      <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                      <div className={`text-3xl font-bold bg-gradient-to-r ${plan.color} bg-clip-text text-transparent`}>
                        {plan.price}
                      </div>
                    </div>
                    
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center text-gray-300">
                          <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mr-3"></div>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    
                    <Button
                      className={`w-full ${
                        settings.currentPlan === plan.id
                          ? "bg-gray-600 cursor-not-allowed"
                          : `bg-gradient-to-r ${plan.color} hover:opacity-90`
                      }`}
                      disabled={settings.currentPlan === plan.id}
                      onClick={() => updateSetting("currentPlan", plan.id)}
                    >
                      {settings.currentPlan === plan.id ? "Current Plan" : "Upgrade"}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Security Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-300">Session Timeout (minutes)</Label>
                    <Input
                      type="number"
                      value={settings.sessionTimeout}
                      onChange={(e) => updateSetting("sessionTimeout", Number.parseInt(e.target.value))}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Password Expiry (days)</Label>
                    <Input
                      type="number"
                      value={settings.passwordExpiry}
                      onChange={(e) => updateSetting("passwordExpiry", Number.parseInt(e.target.value))}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-300">Max Login Attempts</Label>
                    <Input
                      type="number"
                      value={settings.loginAttempts}
                      onChange={(e) => updateSetting("loginAttempts", Number.parseInt(e.target.value))}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-300">Multi-Factor Authentication</Label>
                    <Switch
                      checked={settings.mfaEnabled}
                      onCheckedChange={(checked) => updateSetting("mfaEnabled", checked)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Two-Factor Authentication Setup */}
          <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Two-Factor Authentication
              </CardTitle>
              <p className="text-gray-400">Add an extra layer of security to your account</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${mfaStatus?.enabled ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                  <div>
                    <h4 className="text-white font-medium">Two-Factor Authentication</h4>
                    <p className="text-gray-400 text-sm">
                      {mfaStatus?.enabled ? 'Active - Your account is protected' : 'Disabled - Enable for better security'}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  {mfaStatus?.enabled ? 'Active' : 'Inactive'}
                </div>
              </div>

              {mfaStatus?.enabled && (
                <div className="space-y-4 p-4 bg-gradient-to-r from-green-900/20 to-blue-900/20 rounded-xl border border-green-500/20">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Two-Factor Authentication is Active</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button 
                      onClick={() => navigate('/dashboard/mfa')}
                      variant="outline" 
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      Manage MFA
                    </Button>
                    <Button 
                      onClick={() => navigate('/dashboard/mfa')}
                      variant="outline" 
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      View Recovery Codes
                    </Button>
                    <Button 
                      onClick={() => navigate('/dashboard/mfa')}
                      variant="outline" 
                      className="border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/40"
                    >
                      Disable 2FA
                    </Button>
                  </div>
                </div>
              )}

              {!mfaStatus?.enabled && (
                <div className="space-y-4 p-4 bg-gradient-to-r from-yellow-900/20 to-orange-900/20 rounded-xl border border-yellow-500/20">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">Enable 2FA for Enhanced Security</span>
                  </div>
                  <p className="text-gray-400 text-sm">
                    Protect your account with an additional security layer using your mobile device.
                  </p>
                  <Button 
                    onClick={() => navigate('/dashboard/mfa')}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    Setup Two-Factor Authentication
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-300">Email Alerts</Label>
                    <p className="text-sm text-gray-400">Receive security alerts via email</p>
                  </div>
                  <Switch
                    checked={settings.emailAlerts}
                    onCheckedChange={(checked) => updateSetting("emailAlerts", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-300">Slack Notifications</Label>
                    <p className="text-sm text-gray-400">Send notifications to Slack channels</p>
                  </div>
                  <Switch
                    checked={settings.slackNotifications}
                    onCheckedChange={(checked) => updateSetting("slackNotifications", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-300">Critical Alerts</Label>
                    <p className="text-sm text-gray-400">Immediate notifications for critical issues</p>
                  </div>
                  <Switch
                    checked={settings.criticalAlerts}
                    onCheckedChange={(checked) => updateSetting("criticalAlerts", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-300">Weekly Reports</Label>
                    <p className="text-sm text-gray-400">Receive weekly security summary reports</p>
                  </div>
                  <Switch
                    checked={settings.weeklyReports}
                    onCheckedChange={(checked) => updateSetting("weeklyReports", checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scanning" className="space-y-6">
          <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Scanning Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-300">Default Scan Timeout (seconds)</Label>
                    <Input
                      type="number"
                      value={settings.defaultScanTimeout}
                      onChange={(e) => updateSetting("defaultScanTimeout", Number.parseInt(e.target.value))}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Max Concurrent Scans</Label>
                    <Input
                      type="number"
                      value={settings.maxConcurrentScans}
                      onChange={(e) => updateSetting("maxConcurrentScans", Number.parseInt(e.target.value))}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-300">Data Retention (days)</Label>
                    <Input
                      type="number"
                      value={settings.retentionDays}
                      onChange={(e) => updateSetting("retentionDays", Number.parseInt(e.target.value))}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-300">Auto-Scan Enabled</Label>
                    <Switch
                      checked={settings.autoScanEnabled}
                      onCheckedChange={(checked) => updateSetting("autoScanEnabled", checked)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="thresholds" className="space-y-6">
          <Card className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Detection Thresholds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-6">
                <div>
                  <Label className="text-gray-300">
                    Prompt Injection Threshold: {settings.promptInjectionThreshold}%
                  </Label>
                  <Slider
                    value={[settings.promptInjectionThreshold]}
                    onValueChange={(value) => updateSetting("promptInjectionThreshold", value[0])}
                    max={100}
                    step={5}
                    className="mt-2"
                  />
                  <p className="text-sm text-gray-400 mt-1">Sensitivity for detecting prompt injection attacks</p>
                </div>
                <div>
                  <Label className="text-gray-300">Anomaly Detection Threshold: {settings.anomalyThreshold}%</Label>
                  <Slider
                    value={[settings.anomalyThreshold]}
                    onValueChange={(value) => updateSetting("anomalyThreshold", value[0])}
                    max={100}
                    step={5}
                    className="mt-2"
                  />
                  <p className="text-sm text-gray-400 mt-1">Threshold for flagging behavioral anomalies</p>
                </div>
                <div>
                  <Label className="text-gray-300">Risk Score Threshold: {settings.riskScoreThreshold}%</Label>
                  <Slider
                    value={[settings.riskScoreThreshold]}
                    onValueChange={(value) => updateSetting("riskScoreThreshold", value[0])}
                    max={100}
                    step={5}
                    className="mt-2"
                  />
                  <p className="text-sm text-gray-400 mt-1">Overall risk score threshold for alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={resetSettings}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
        <Button onClick={saveSettings} className="bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-2" />
          Save Settings
        </Button>
      </div>
    </div>
  )
}
