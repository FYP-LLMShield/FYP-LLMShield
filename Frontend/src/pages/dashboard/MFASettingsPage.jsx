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
      <div className="space-y-4">
          <div className="bg-white p-6 rounded-lg">
            <TOTPInput
              value={totpCode}
              onComplete={(code) => {
                setTotpCode(code)
                setError("")
              }}
              loading={isLoading}
              error={error}
            />
          </div>

        <div className="flex space-x-3">
          <button
            onClick={() => setSetupStep(1)}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleVerifySetup}
            disabled={isLoading || totpCode.length !== 6}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors"
          >
            {isLoading ? "Verifying..." : "Verify & Enable"}
          </button>
        </div>
      </div>
    </div>
  )

  const RecoveryCodesStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">MFA Enabled Successfully!</h3>
        <p className="text-gray-400 mb-6">
          Save these recovery codes in a safe place. You can use them to access your account if you lose your authenticator device.
        </p>
      </div>

      <div className="bg-yellow-900/20 border border-yellow-500/30 p-4 rounded-lg">
        <div className="flex items-center space-x-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          <span className="text-yellow-400 font-medium">Important</span>
        </div>
        <ul className="text-gray-300 text-sm space-y-1">
          <li>• Each recovery code can only be used once</li>
          <li>• Store them in a secure location (password manager, safe, etc.)</li>
          <li>• Don't share these codes with anyone</li>
        </ul>
      </div>

      <RecoveryCodes 
        codes={setupData?.recovery_codes}
        onRegenerate={handleRegenerateRecoveryCodes}
        loading={isLoading}
      />

      <button
        onClick={() => {
          setSetupData(null)
          setSetupStep(1)
          setSuccess("")
        }}
        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
      >
        Complete Setup
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-8"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <Shield className="w-8 h-8 text-blue-400" />
              <div>
                <h1 className="text-2xl font-bold text-white">Two-Factor Authentication</h1>
                <p className="text-gray-400">Secure your account with an additional layer of protection</p>
              </div>
            </div>
            <Link 
              to="/dashboard/settings"
              className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Settings</span>
            </Link>
          </div>

          {success && (
            <div className="mb-6 text-green-400 text-sm bg-green-900/20 border border-green-500/30 p-3 rounded-lg">
              {success}
            </div>
          )}

          {(() => {
            console.log('Render condition check:', {
              mfaEnabled: mfaStatus.enabled,
              setupData: !!setupData,
              shouldShowEnableButton: !mfaStatus.enabled && !setupData
            })
            return !mfaStatus.enabled && !setupData
          })() ? (
            <div className="space-y-6">
              <div className="bg-blue-900/20 border border-blue-500/30 p-6 rounded-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <Smartphone className="w-6 h-6 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">Enable Two-Factor Authentication</h3>
                </div>
                <p className="text-gray-300 mb-4">
                  Add an extra layer of security to your account. You'll need an authenticator app like Google Authenticator or Authy.
                </p>
                <ul className="text-gray-400 text-sm space-y-2 mb-6">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>Protects against unauthorized access</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>Works offline with your authenticator app</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>Includes backup recovery codes</span>
                  </li>
                </ul>
                <button
                  onClick={handleEnableMFA}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg font-medium transition-colors"
                >
                  {isLoading ? "Setting up..." : "Enable MFA"}
                </button>
              </div>
            </div>
          ) : setupData && !mfaStatus.enabled ? (
            <div>
              {setupStep === 1 && <QRCodeStep />}
              {setupStep === 2 && <VerifyStep />}
              {setupStep === 3 && <RecoveryCodesStep />}
            </div>
          ) : mfaStatus.enabled ? (
            <div className="space-y-6">
              <div className="bg-green-900/20 border border-green-500/30 p-6 rounded-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <h3 className="text-lg font-semibold text-white">MFA is Enabled</h3>
                </div>
                <p className="text-gray-300 mb-4">
                  Your account is protected with two-factor authentication.
                </p>
                <div className="flex items-center space-x-4 text-sm text-gray-400">
                  <span>Recovery codes remaining: {mfaStatus.recoveryCodesRemaining}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={handleRegenerateRecoveryCodes}
                  disabled={isLoading}
                  className="flex items-center justify-center space-x-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{isLoading ? "Generating..." : "Regenerate Codes"}</span>
                </button>
                
                <button
                  onClick={() => setShowRecoveryCodes(!showRecoveryCodes)}
                  className="flex items-center justify-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  <Key className="w-4 h-4" />
                  <span>{showRecoveryCodes ? "Hide" : "Show"} Recovery Codes</span>
                </button>
              </div>

              {showRecoveryCodes && (
                <div className="space-y-4">
                  {currentRecoveryCodes.length > 0 ? (
                    <RecoveryCodes 
                      codes={currentRecoveryCodes}
                      onRegenerate={handleRegenerateRecoveryCodes}
                      loading={isLoading}
                    />
                  ) : (
                    <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-6 text-center">
                      <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-white mb-2">Recovery Codes Not Available</h3>
                      <p className="text-gray-400 mb-4">
                        For security reasons, recovery codes cannot be displayed after they've been saved. 
                        You can regenerate new codes if needed.
                      </p>
                      <button
                        onClick={handleRegenerateRecoveryCodes}
                        disabled={isLoading}
                        className="flex items-center justify-center space-x-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg font-medium transition-colors mx-auto"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>{isLoading ? "Generating..." : "Regenerate Recovery Codes"}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}



