import React, { useState } from "react"
import { AuthStateContext, useAuth } from "./AuthStateContext"
import { authAPI, mfaAPI } from '../lib/api'
import { supabase, isSupabaseAuthAvailable, isSupabaseUnavailableError } from '../lib/supabase'

/** Align apiClient Bearer token with Supabase session (fixes stale localStorage token → 401 / wrong user). */
async function syncSupabaseSessionToApiClient() {
  if (!supabase) return
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error || !data?.session?.access_token) return
    const t = data.session.access_token
    localStorage.setItem('access_token', t)
    authAPI.setToken(t)
  } catch (_) {
    /* ignore */
  }
}

function profilePictureCacheKey(userIdOrEmail) {
  return userIdOrEmail ? `profile_picture_cache:${userIdOrEmail}` : null
}

function cacheProfilePicture(userIdOrEmail, profilePicture) {
  const key = profilePictureCacheKey(userIdOrEmail)
  if (!key) return
  try {
    if (profilePicture) localStorage.setItem(key, profilePicture)
    else localStorage.removeItem(key)
  } catch (_) {
    /* ignore */
  }
}

function readCachedProfilePicture(userIdOrEmail) {
  const key = profilePictureCacheKey(userIdOrEmail)
  if (!key) return null
  try {
    return localStorage.getItem(key)
  } catch (_) {
    return null
  }
}

export { useAuth }

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true) // Start with loading true
  const [isInitialized, setIsInitialized] = useState(false)
  const [mfaStatus, setMfaStatus] = useState({
    enabled: false,
    setupComplete: false,
    recoveryCodesRemaining: 0
  })

  // Login: try Supabase Auth first; if Supabase is down, use backend (fallback)
  const login = async (email, password) => {
    setIsLoading(true)
    try {
      // 1) Try Supabase Auth first (primary)
      if (isSupabaseAuthAvailable() && supabase) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password })
          if (!error && data?.session && data?.user) {
            const session = data.session
            const u = data.user
            // Only allow login for users who have confirmed their email (prevents "sign in" with never-registered or unverified accounts)
            if (!u.email_confirmed_at) {
              setIsLoading(false)
              throw new Error('Please verify your email before signing in. Check your inbox for the verification link.')
            }
            const userData = {
              id: u?.id || null,
              email: u?.email || email,
              name: u?.user_metadata?.full_name || u?.user_metadata?.name || email.split('@')[0],
              username: u?.user_metadata?.username || u?.email?.split('@')[0],
              profile_picture: u?.user_metadata?.profile_picture || u?.user_metadata?.avatar_url || null,
              phone_number: u?.user_metadata?.phone_number || null,
              location: u?.user_metadata?.location || null,
              job_role: u?.user_metadata?.job_role || null,
              company: u?.user_metadata?.company || null,
              bio: u?.user_metadata?.bio || null,
              plan: "free",
              isVerified: true,
              mfaEnabled: false
            }
            localStorage.setItem('access_token', session.access_token)
            authAPI.setToken(session.access_token)
            setUser(userData)
            localStorage.setItem("user", JSON.stringify(userData))
            setIsLoading(false)
            return userData
          }
          if (error && isSupabaseUnavailableError(error)) {
            // Supabase down -> fallback to backend
          } else if (error) {
            setIsLoading(false)
            throw new Error(error.message || 'Login failed')
          }
        } catch (supabaseErr) {
          if (isSupabaseUnavailableError(supabaseErr)) {
            // Fall through to backend fallback
          } else {
            setIsLoading(false)
            throw supabaseErr
          }
        }
      }

      // 2) Fallback: backend auth (when Supabase Auth unavailable or not configured)
      const response = await authAPI.login({ email, password })
      // Only treat as success when we have a valid 200 response with user and token (never for non-existent users)
      if (!response.success || !response.data) {
        setIsLoading(false)
        throw new Error(response.error || 'Incorrect email or password')
      }
      if (response.data.mfa_required) {
        setIsLoading(false)
        localStorage.setItem('partial_token', response.data.partial_token)
        const mfaError = new Error('MFA verification required')
        mfaError.requiresMfa = true
        throw mfaError
      }
      if (response.data.user && response.data.access_token) {
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
          name: response.data.user.name || response.data.user.full_name || email.split('@')[0],
          username: response.data.user.username || response.data.user.email?.split('@')[0],
          profile_picture: response.data.user.profile_picture || null,
          phone_number: response.data.user.phone_number || null,
          location: response.data.user.location || null,
          job_role: response.data.user.job_role || null,
          company: response.data.user.company || null,
          bio: response.data.user.bio || null,
          plan: "free",
          isVerified: response.data.user.is_verified || false,
          mfaEnabled: false
        }
        setUser(userData)
        localStorage.setItem("user", JSON.stringify(userData))
        try {
          const mfaResponse = await mfaAPI.getStatus()
          if (mfaResponse.success && mfaResponse.data) {
            const updatedUserData = { ...userData, mfaEnabled: mfaResponse.data.mfa_enabled }
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
      }
      setIsLoading(false)
      throw new Error(response.error || 'Login failed')
    } catch (error) {
      setIsLoading(false)
      throw error
    }
  }

  // Signup: try Supabase Auth first; if Supabase is down, use backend (fallback)
  const signup = async (name, username, email, password) => {
    setIsLoading(true)
    try {
      // 1) Try Supabase Auth first (primary)
      if (isSupabaseAuthAvailable() && supabase) {
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: name, username }
            }
          })
          if (!error) {
            // Supabase may require email confirmation; don't set user/token
            const userData = {
              id: data?.user?.id || null,
              email: data?.user?.email || email,
              name,
              username,
              plan: "free",
              isVerified: !!data?.user?.email_confirmed_at
            }
            setIsLoading(false)
            return userData
          }
          if (error && isSupabaseUnavailableError(error)) {
            // Fall through to backend fallback
          } else {
            setIsLoading(false)
            throw new Error(error.message || 'Registration failed')
          }
        } catch (supabaseErr) {
          if (isSupabaseUnavailableError(supabaseErr)) {
            // Fall through to backend fallback
          } else {
            setIsLoading(false)
            throw supabaseErr
          }
        }
      }

      // 2) Fallback: backend register (when Supabase Auth unavailable or not configured)
      const response = await authAPI.register({
        name,
        username,
        email,
        password
      })
      if (response.success && response.data) {
        const userData = {
          id: response.data.user_id || null,
          email: response.data.email || email,
          name,
          username,
          plan: "free",
          isVerified: false
        }
        setIsLoading(false)
        return userData
      }
      setIsLoading(false)
      throw new Error(response.error || 'Registration failed')
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

  const updateUser = async (patch) => {
    if (!user) return null
    const next = { ...user, ...patch }
    // Optimistic UI
    setUser(next)
    localStorage.setItem("user", JSON.stringify(next))
    if (Object.prototype.hasOwnProperty.call(patch || {}, "profile_picture")) {
      cacheProfilePicture(next.id || next.email, next.profile_picture)
    }
    try {
      // Keep Supabase session metadata aligned when available
      if (isSupabaseAuthAvailable() && supabase) {
        try {
          await supabase.auth.updateUser({
            data: {
              username: next.username,
              profile_picture: next.profile_picture,
              phone_number: next.phone_number,
              location: next.location,
              job_role: next.job_role,
              company: next.company,
              bio: next.bio,
              full_name: next.name,
              name: next.name,
            },
          })
        } catch (_) {
          /* ignore */
        }
      }
      // Persist to backend user row (Supabase users table via service role OR Mongo fallback)
      const payload = {
        username: next.username,
        name: next.name,
        profile_picture: next.profile_picture,
        phone_number: next.phone_number,
        location: next.location,
        job_role: next.job_role,
        company: next.company,
        bio: next.bio,
      }
      const res = await authAPI.updateProfile(payload)
      if (res?.success && res?.data?.user) {
        const u = res.data.user
        const merged = {
          ...next,
          username: u.username ?? next.username,
          name: u.name ?? next.name,
          profile_picture: u.profile_picture ?? next.profile_picture,
          phone_number: u.phone_number ?? next.phone_number,
          location: u.location ?? next.location,
          job_role: u.job_role ?? next.job_role,
          company: u.company ?? next.company,
          bio: u.bio ?? next.bio,
        }
        // Ensure we never lose an existing avatar on a partial response
        if (!merged.profile_picture) {
          merged.profile_picture = next.profile_picture || readCachedProfilePicture(merged.id || merged.email)
        }
        setUser(merged)
        localStorage.setItem("user", JSON.stringify(merged))
        cacheProfilePicture(merged.id || merged.email, merged.profile_picture)
        return merged
      }
      return next
    } catch (e) {
      console.warn("updateUser failed:", e)
      return next
    }
  }

  const logout = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut()
      } catch (e) {
        console.warn('Supabase signOut:', e)
      }
    }
    try {
      if (user?.id || user?.email) {
        localStorage.removeItem(profilePictureCacheKey(user.id || user.email))
      }
    } catch (_) {
      /* ignore */
    }
    authAPI.logout()
    setUser(null)
    setMfaStatus({ enabled: false, setupComplete: false, recoveryCodesRemaining: 0 })
    localStorage.removeItem("user")
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    localStorage.removeItem("partial_token")
  }

  // MFA-related functions
  const fetchMfaStatus = async () => {
    await syncSupabaseSessionToApiClient()
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
    await syncSupabaseSessionToApiClient()
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

  const completeMfaSetup = async (totpCode, setupId = null) => {
    await syncSupabaseSessionToApiClient()
    try {
      const body = { totp_code: totpCode }
      if (setupId) body.setup_id = setupId
      const response = await mfaAPI.completeSetup(body)
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
    await syncSupabaseSessionToApiClient()
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
    await syncSupabaseSessionToApiClient()
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

      // 1) Try Supabase Auth session first (primary)
      if (isSupabaseAuthAvailable() && supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user && session?.access_token) {
            const u = session.user
            const userData = {
              id: u.id,
              email: u.email,
              name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0],
              plan: "free",
              isVerified: !!u.email_confirmed_at,
              mfaEnabled: false
            }
            const cachedPic = readCachedProfilePicture(userData.id || userData.email)
            if (cachedPic) userData.profile_picture = cachedPic
            setUser(userData)
            localStorage.setItem("user", JSON.stringify(userData))
            localStorage.setItem('access_token', session.access_token)
            authAPI.setToken(session.access_token)

            // Enrich from backend profile row so avatar/profile fields persist across refresh.
            // This endpoint now accepts Supabase tokens.
            try {
              const me = await authAPI.getCurrentUser()
              if (me?.success && me?.data?.user) {
                const u2 = me.data.user
                const merged = {
                  ...userData,
                  username: u2.username ?? userData.username,
                  name: u2.name ?? userData.name,
                  profile_picture: u2.profile_picture ?? userData.profile_picture,
                  phone_number: u2.phone_number ?? userData.phone_number,
                  location: u2.location ?? userData.location,
                  job_role: u2.job_role ?? userData.job_role,
                  company: u2.company ?? userData.company,
                  bio: u2.bio ?? userData.bio,
                }
                if (!merged.profile_picture) {
                  merged.profile_picture = readCachedProfilePicture(merged.id || merged.email)
                }
                setUser(merged)
                localStorage.setItem("user", JSON.stringify(merged))
                cacheProfilePicture(merged.id || merged.email, merged.profile_picture)
              }
            } catch (_) {
              /* ignore */
            }

            setIsLoading(false)
            setIsInitialized(true)
            return
          }
        } catch (e) {
          console.warn('Supabase getSession failed, using backend session if any:', e)
        }
      }

      // 2) Fallback: backend session (localStorage)
      const savedUser = localStorage.getItem("user")
      const token = localStorage.getItem('access_token')
      const refreshToken = localStorage.getItem('refresh_token')

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
                profile_picture: userData.user.profile_picture || null,
                phone_number: userData.user.phone_number || null,
                location: userData.user.location || null,
                job_role: userData.user.job_role || null,
                company: userData.user.company || null,
                bio: userData.user.bio || null,
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
                      profile_picture: refreshedUserData.user.profile_picture || null,
                      phone_number: refreshedUserData.user.phone_number || null,
                      location: refreshedUserData.user.location || null,
                      job_role: refreshedUserData.user.job_role || null,
                      company: refreshedUserData.user.company || null,
                      bio: refreshedUserData.user.bio || null,
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
                profile_picture: refreshedUserData.user.profile_picture || null,
                phone_number: refreshedUserData.user.phone_number || null,
                location: refreshedUserData.user.location || null,
                job_role: refreshedUserData.user.job_role || null,
                company: refreshedUserData.user.company || null,
                bio: refreshedUserData.user.bio || null,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount to restore session
  }, [])

  return (
    <AuthStateContext.Provider
      value={{
        user,
        setUser,
        updateUser,
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
    </AuthStateContext.Provider>
  )
}