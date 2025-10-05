import React, { createContext, useContext, useState } from "react"
import { authAPI, mfaAPI } from '../lib/api'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true) // Start with loading true
  const [isInitialized, setIsInitialized] = useState(false)
  const [mfaStatus, setMfaStatus] = useState({
    enabled: false,
    setupComplete: false,
    recoveryCodesRemaining: 0
  })

  // Real login function with backend API
  const login = async (email, password) => {
    setIsLoading(true)
    try {
      const response = await authAPI.login({ email, password })
      
      // Check if MFA verification is required
      if (response.data && response.data.mfa_required) {
        setIsLoading(false)
        // Store the partial token for MFA verification
        localStorage.setItem('partial_token', response.data.partial_token)
        // Throw error with MFA requirement info for the UI to handle
        const mfaError = new Error('MFA verification required')
        mfaError.requiresMfa = true
        throw mfaError
      }
      
      if (response.success && response.data && response.data.user) {
        const userData = {
          id: response.data.user.id || null,
          email: response.data.user.email || email,
          name: response.data.user.full_name || email.split('@')[0],
          plan: "free", // Default plan
          isVerified: response.data.user.is_verified || false,
          mfaEnabled: false // Will be updated after fetching MFA status
        }
        
        setUser(userData)
        localStorage.setItem("user", JSON.stringify(userData))
        
        // Fetch MFA status after successful login
        try {
          const mfaResponse = await mfaAPI.getStatus()
          if (mfaResponse.success && mfaResponse.data) {
            const updatedUserData = {
              ...userData,
              mfaEnabled: mfaResponse.data.mfa_enabled
            }
            setUser(updatedUserData)
            localStorage.setItem("user", JSON.stringify(updatedUserData))
            setMfaStatus({
              enabled: mfaResponse.data.mfa_enabled,
              setupComplete: mfaResponse.data.setup_complete,
              recoveryCodesRemaining: mfaResponse.data.recovery_codes_remaining
            })
          }
        } catch (mfaError) {
          console.warn('Failed to fetch MFA status:', mfaError)
        }
        
        setIsLoading(false)
        return userData
      } else {
        setIsLoading(false)
        throw new Error(response.error || 'Login failed')
      }
    } catch (error) {
      setIsLoading(false)
      throw error
    }
  }

  // Real signup function with backend API
  const signup = async (name, username, email, password) => {
    setIsLoading(true)
    try {
      const response = await authAPI.register({ 
        name, 
        username,
        email, 
        password 
      })
      
      if (response.success && response.data) {
        // Handle the actual backend response format
        // Backend returns: {message, user_id, email, verification_required}
        const userData = {
          id: response.data.user_id || null,
          email: response.data.email || email,
          name: name, // Use the provided name
          username: username, // Use the provided username
          plan: "free", // Default plan
          isVerified: false // New registrations are not verified initially
        }
        
        setUser(userData)
        localStorage.setItem("user", JSON.stringify(userData))
        setIsLoading(false)
        return userData
      } else {
        setIsLoading(false)
        throw new Error(response.error || 'Registration failed')
      }
    } catch (error) {
      setIsLoading(false)
      // Handle validation errors from backend
      if (error.response && error.response.status === 422) {
        const validationErrors = error.response.data?.detail
        if (Array.isArray(validationErrors)) {
          // Map validation errors to user-friendly messages
          const errorMessages = validationErrors.map(err => {
            // Extract field name from error location
            const field = err.loc[err.loc.length - 1]
            switch (field) {
              case 'email':
                return err.msg === 'Email already registered' ? 'User with this email already exists' : err.msg
              case 'username':
                return err.msg === 'Username already taken' ? 'User with this username already exists' : err.msg
              case 'password':
                if (err.msg.includes('at least 8 characters')) {
                  return 'Password must be at least 8 characters long'
                } else if (err.msg.includes('uppercase')) {
                  return 'Password must contain at least one uppercase letter'
                } else if (err.msg.includes('digit')) {
                  return 'Password must contain at least one digit'
                } else if (err.msg.includes('special character')) {
                  return 'Password must contain at least one special character'
                }
                return err.msg
              default:
                return err.msg
            }
          }).join(', ')
          throw new Error(errorMessages)
        }
      }
      // Handle other backend errors
      if (error.response && error.response.data && error.response.data.detail) {
        throw new Error(error.response.data.detail)
      }
      throw error
    }
  }

  const logout = () => {
    authAPI.logout() // Clear token from API client
    setUser(null)
    setMfaStatus({ enabled: false, setupComplete: false, recoveryCodesRemaining: 0 })
    localStorage.removeItem("user")
  }
