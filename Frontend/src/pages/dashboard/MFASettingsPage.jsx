import { useState, useEffect, useCallback, memo } from "react"
import { motion } from "framer-motion"
import { Shield, Smartphone, Key, AlertTriangle, CheckCircle, Copy, RefreshCw, Eye, EyeOff, ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"
import { useAuth } from "../../contexts/AuthContext"
import QRCode from "../../components/QRCode"
import TOTPInput from "../../components/TOTPInput"
import RecoveryCodes from "../../components/RecoveryCodes"

const MFASettingsPage = () => {
  const { user, mfaStatus, fetchMfaStatus, initiateMfaSetup, completeMfaSetup, disableMfa, regenerateRecoveryCodes } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [setupStep, setSetupStep] = useState(1) // 1: QR Code, 2: Verify, 3: Recovery Codes
  const [setupData, setSetupData] = useState(null)
  const [totpCode, setTotpCode] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [copiedItems, setCopiedItems] = useState(new Set())
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false)
  const [showDisableMFA, setShowDisableMFA] = useState(false)
  const [currentRecoveryCodes, setCurrentRecoveryCodes] = useState([])

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    
    // Test if user is actually logged in
    if (!user || !token) {
      console.error('User not authenticated! Redirecting...')
      // You might want to redirect to login page here
    }
    
    fetchMfaStatus().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleEnableMFA = async () => {
    setIsLoading(true)
    setError("")
    try {
      const data = await initiateMfaSetup()
      setSetupData(data)
      setSetupStep(1)
    } catch (err) {
      console.error('MFA Setup error:', err)
      setError(err.message || "Failed to initiate MFA setup")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifySetup = async () => {
    if (totpCode.length !== 6) {
      setError("Please enter a 6-digit code")
      return
    }

    setIsLoading(true)
    setError("")
    try {
      await completeMfaSetup(totpCode)
      setSetupStep(3)
      setSuccess("MFA has been successfully enabled!")
      setTotpCode("")
    } catch (err) {
      setError(err.message || "Invalid verification code")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisableMFA = useCallback(async () => {
    if (!currentPassword || totpCode.length !== 6) {
      setError("Please enter your password and a 6-digit TOTP code")
      return
    }

    setIsLoading(true)
    setError("")
    try {
      await disableMfa(currentPassword, totpCode)
      setSuccess("MFA has been disabled successfully")
      setCurrentPassword("")
      setTotpCode("")
      setSetupData(null)
      setSetupStep(1)
    } catch (err) {
      setError(err.message || "Failed to disable MFA")
    } finally {
      setIsLoading(false)
    }
  }, [currentPassword, totpCode, disableMfa])

  const handleRegenerateRecoveryCodes = async () => {
    setIsLoading(true)
    setError("")
    try {
      const data = await regenerateRecoveryCodes()
      setSetupData({ ...setupData, recovery_codes: data.recovery_codes })
      setCurrentRecoveryCodes(data.recovery_codes)
      setSuccess("Recovery codes have been regenerated")
    } catch (err) {
      setError(err.message || "Failed to regenerate recovery codes")
    } finally {
      setIsLoading(false)
    }
  }
  const copyToClipboard = async (text, item) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedItems(prev => new Set([...prev, item]))
      setTimeout(() => {
        setCopiedItems(prev => {
          const newSet = new Set(prev)
          newSet.delete(item)
          return newSet
        })
      }, 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const QRCodeStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-white mb-2">Scan QR Code</h3>
        <p className="text-gray-400 mb-6">
          Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
        </p>
      </div>

      <div className="flex justify-center mb-6">
        <QRCode value={setupData?.qr_code} size={200} />
      </div>

      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Manual Entry Key:</span>
          <button
            onClick={() => copyToClipboard(setupData?.secret, 'secret')}
            className="flex items-center space-x-1 text-blue-400 hover:text-blue-300"
          >
            {copiedItems.has('secret') ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            <span className="text-xs">{copiedItems.has('secret') ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
        <code className="text-white font-mono text-sm break-all">
          {setupData?.secret}
        </code>
      </div>

      <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-blue-400" />
          <span className="text-blue-400 font-medium">Backup URL</span>
        </div>
        <p className="text-gray-300 text-sm mb-2">
          Save this URL as a backup way to add the account to your authenticator:
        </p>
        <div className="flex items-center justify-between bg-gray-800 p-2 rounded">
          <code className="text-white font-mono text-xs break-all flex-1 mr-2">
            {setupData?.backup_url}
          </code>
          <button
            onClick={() => copyToClipboard(setupData?.backup_url, 'backup_url')}
            className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 flex-shrink-0"
          >
            {copiedItems.has('backup_url') ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <button
        onClick={() => setSetupStep(2)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
      >
        I've Added the Account
      </button>
    </div>
  )

  const VerifyStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-white mb-2">Verify Setup</h3>
        <p className="text-gray-400 mb-6">
          Enter the 6-digit code from your authenticator app to complete setup
        </p>
      </div>

