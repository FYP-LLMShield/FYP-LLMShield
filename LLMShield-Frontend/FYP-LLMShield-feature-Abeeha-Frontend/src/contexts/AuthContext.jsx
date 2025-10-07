
import React, { createContext, useContext, useState } from "react"
import { authAPI } from '../lib/api'

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
  const [isLoading, setIsLoading] = useState(false)

  // Real login function with backend API
  const login = async (email, password) => {
    setIsLoading(true)
    try {
      const response = await authAPI.login({ email, password })
      
      if (response.success && response.data) {
        const userData = {
          id: response.data.user.id,
          email: response.data.user.email,
          name: response.data.user.full_name,
          plan: "free", // Default plan
          isVerified: response.data.user.is_verified
        }
        
        setUser(userData)
        localStorage.setItem("user", JSON.stringify(userData))
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
  const signup = async (name, email, password) => {
    setIsLoading(true)
    try {
      const response = await authAPI.register({ 
        full_name: name, 
        email, 
        password 
      })
      
      if (response.success && response.data) {
        const userData = {
          id: response.data.user.id,
          email: response.data.user.email,
          name: response.data.user.full_name,
          plan: "free", // Default plan
          isVerified: response.data.user.is_verified
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
      throw error
    }
  }

  const logout = () => {
    authAPI.logout() // Clear token from API client
    setUser(null)
    localStorage.removeItem("user")
  }

  // Check for existing user on app load
  React.useEffect(() => {
    const savedUser = localStorage.getItem("user")
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signup,
        logout,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}