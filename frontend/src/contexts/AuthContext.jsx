
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
        // Store tokens FIRST - this is critical for authentication!
        if (response.data.access_token) {
          localStorage.setItem('access_token', response.data.access_token)
          authAPI.setToken(response.data.access_token)
        }
        if (response.data.refresh_token) {
          localStorage.setItem('refresh_token', response.data.refresh_token)
        }
        
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
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
  }

  // MFA-related functions
  const fetchMfaStatus = async () => {
    try {
      const response = await mfaAPI.getStatus()
      if (response.success && response.data) {
        setMfaStatus({
          enabled: response.data.mfa_enabled,
          setupComplete: response.data.setup_complete,
          recoveryCodesRemaining: response.data.recovery_codes_remaining
        })
        
        // Update user object with MFA status
        if (user) {
          const updatedUser = { ...user, mfaEnabled: response.data.mfa_enabled }
          setUser(updatedUser)
          localStorage.setItem("user", JSON.stringify(updatedUser))
        }
        
        return response.data
      }
    } catch (error) {
      console.error('Failed to fetch MFA status:', error)
      throw error
    }
  }

  const initiateMfaSetup = async () => {
    try {
      const response = await mfaAPI.initiateSetup()
      if (response.success && response.data) {
        return response.data
      }
      throw new Error(response.error || 'Failed to initiate MFA setup')
    } catch (error) {
      console.error('Failed to initiate MFA setup:', error)
      throw error
    }
  }

  const completeMfaSetup = async (totpCode) => {
    try {
      const response = await mfaAPI.completeSetup({ totp_code: totpCode })
      if (response.success && response.data) {
        // Refresh MFA status after successful setup
        await fetchMfaStatus()
        return response.data
      }
      throw new Error(response.error || 'Failed to complete MFA setup')
    } catch (error) {
      console.error('Failed to complete MFA setup:', error)
      throw error
    }
  }

  const disableMfa = async (currentPassword, totpCode) => {
    try {
      const response = await mfaAPI.disable({ 
        current_password: currentPassword, 
        totp_code: totpCode 
      })
      if (response.success && response.data) {
        // Refresh MFA status after successful disable
        await fetchMfaStatus()
        return response.data
      }
      throw new Error(response.error || 'Failed to disable MFA')
    } catch (error) {
      console.error('Failed to disable MFA:', error)
      throw error
    }
  }

  const regenerateRecoveryCodes = async () => {
    try {
      const response = await mfaAPI.regenerateRecoveryCodes()
      if (response.success && response.data) {
        // Refresh MFA status after regenerating codes
        await fetchMfaStatus()
        return response.data
      }
      throw new Error(response.error || 'Failed to regenerate recovery codes')
    } catch (error) {
      console.error('Failed to regenerate recovery codes:', error)
      throw error
    }
  }

  // Validate current token
  const validateToken = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      return null
    }

    try {
      const response = await authAPI.getCurrentUser()
      if (response.success && response.data) {
        return response.data
      } else {
        // Token is invalid, try to refresh
        const refreshToken = localStorage.getItem('refresh_token')
        if (refreshToken) {
          return await refreshAccessToken()
        }
        return null
      }
    } catch (error) {
      console.error('Token validation failed:', error)
      // Try to refresh token
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        return await refreshAccessToken()
      }
      // Return null instead of false for consistency
      return null
    }
  }

  // Refresh access token using refresh token
  const refreshAccessToken = async () => {
    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
      return null
    }

    try {
      const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1'
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${refreshToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.access_token) {
          localStorage.setItem('access_token', data.access_token)
          // Update API client token
          authAPI.setToken(data.access_token)
          
          // Get user data with new token
          const userResponse = await authAPI.getCurrentUser()
          if (userResponse.success && userResponse.data) {
            return userResponse.data
          }
        }
      } else if (response.status === 401) {
        // Refresh token is invalid, clear everything
        console.warn('Refresh token is invalid, clearing session')
        logout()
        return null
      }
      return null
    } catch (error) {
      console.error('Token refresh failed:', error)
      // Don't clear session on network errors - might be temporary
      return null
    }
  }

  // Check for existing user and validate token on app load
  React.useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true)
      
      const savedUser = localStorage.getItem("user")
      const token = localStorage.getItem('access_token')
      const refreshToken = localStorage.getItem('refresh_token')
      
      // Optimistically restore user from localStorage to prevent redirect during validation
      if (savedUser && token) {
        try {
          const parsedUser = JSON.parse(savedUser)
          // Set user immediately from localStorage to maintain session
          setUser(parsedUser)
          // Set token in API client
          authAPI.setToken(token)
          
          // Validate token in background (non-blocking)
          // This allows the user to stay logged in even if validation is slow
          validateToken().then((userData) => {
            if (userData && userData.user) {
              // Update user data with fresh info from server
              const updatedUser = {
                id: userData.user.id,
                email: userData.user.email,
                name: userData.user.name || userData.user.email.split('@')[0],
                username: userData.user.username || userData.user.email.split('@')[0],
                plan: "free",
                isVerified: userData.user.is_verified,
                mfaEnabled: userData.user.mfa_enabled
              }
              setUser(updatedUser)
              localStorage.setItem("user", JSON.stringify(updatedUser))
              
              // Fetch MFA status
              fetchMfaStatus().catch(error => {
                console.warn('Failed to fetch MFA status:', error)
              })
            } else {
              // Token validation failed, try refresh token
              if (refreshToken) {
                refreshAccessToken().then((refreshedUserData) => {
                  if (refreshedUserData && refreshedUserData.user) {
                    const updatedUser = {
                      id: refreshedUserData.user.id,
                      email: refreshedUserData.user.email,
                      name: refreshedUserData.user.name || refreshedUserData.user.email.split('@')[0],
                      username: refreshedUserData.user.username || refreshedUserData.user.email.split('@')[0],
                      plan: "free",
                      isVerified: refreshedUserData.user.is_verified,
                      mfaEnabled: refreshedUserData.user.mfa_enabled
                    }
                    setUser(updatedUser)
                    localStorage.setItem("user", JSON.stringify(updatedUser))
                  } else {
                    // Both token and refresh failed, clear everything
                    console.warn('Token validation and refresh both failed, clearing session')
                    logout()
                  }
                }).catch(() => {
                  // Refresh failed, but don't clear immediately - let user continue
                  console.warn('Token refresh failed, but keeping session for now')
                })
              } else {
                // No refresh token, but keep user logged in with cached data
                // Only clear if we get a definitive 401 on next API call
                console.warn('Token validation failed but no refresh token, keeping cached session')
              }
            }
          }).catch((error) => {
            // Network error or other issue - don't clear session
            console.warn('Token validation error (network issue?), keeping cached session:', error)
          })
        } catch (parseError) {
          console.error('Error parsing saved user:', parseError)
          // If we can't parse user, clear everything
          logout()
        }
      } else if (savedUser && !token) {
        // User data exists but no token - try refresh token if available
        if (refreshToken) {
          try {
            const refreshedUserData = await refreshAccessToken()
            if (refreshedUserData && refreshedUserData.user) {
              const updatedUser = {
                id: refreshedUserData.user.id,
                email: refreshedUserData.user.email,
                name: refreshedUserData.user.name || refreshedUserData.user.email.split('@')[0],
                username: refreshedUserData.user.username || refreshedUserData.user.email.split('@')[0],
                plan: "free",
                isVerified: refreshedUserData.user.is_verified,
                mfaEnabled: refreshedUserData.user.mfa_enabled
              }
              setUser(updatedUser)
              localStorage.setItem("user", JSON.stringify(updatedUser))
            } else {
              logout()
            }
          } catch (error) {
            console.error('Refresh token failed:', error)
            logout()
          }
        } else {
          // No token and no refresh token, clear everything
          logout()
        }
      }
      
      setIsLoading(false)
      setIsInitialized(true)
    }

    initializeAuth()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        login,
        signup,
        logout,
        isLoading,
        isInitialized,
        mfaStatus,
        fetchMfaStatus,
        initiateMfaSetup,
        completeMfaSetup,
        disableMfa,
        regenerateRecoveryCodes,
        validateToken,
        refreshAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}