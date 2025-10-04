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
