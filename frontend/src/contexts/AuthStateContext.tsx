import React, { createContext, useContext } from "react"
import type { AuthContextValue } from "./AuthContext.types"

/**
 * Lightweight context + hook only. No api/supabase imports.
 * Prevents "Cannot access useAuth before initialization" from circular deps.
 */
const AuthStateContext = createContext<AuthContextValue | null>(null)

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthStateContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export { AuthStateContext }
