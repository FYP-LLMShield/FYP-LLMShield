/**
 * Types for Auth context value. Used by AuthStateContext and consumers.
 */
export interface AuthUser {
  id?: string | null
  email?: string
  name?: string
  username?: string
  profile_picture?: string
  phone_number?: string
  location?: string
  job_role?: string
  company?: string
  bio?: string
  plan?: string
  isVerified?: boolean
  mfaEnabled?: boolean
  [key: string]: unknown
}

export interface MfaStatus {
  enabled: boolean
  setupComplete?: boolean
  recoveryCodesRemaining?: number
}

export interface AuthContextValue {
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
  updateUser: (patch: Partial<AuthUser>) => Promise<AuthUser | null>
  login: (email: string, password: string) => Promise<AuthUser | unknown>
  signup: (name: string, username: string, email: string, password: string) => Promise<unknown>
  logout: () => void
  isLoading: boolean
  isInitialized: boolean
  /** True after the first MFA status fetch finishes for this session (success or failure). */
  mfaStatusHydrated: boolean
  mfaStatus: MfaStatus
  fetchMfaStatus: () => Promise<void>
  initiateMfaSetup: () => Promise<unknown>
  completeMfaSetup: (totpCode: string, setupId?: string | null) => Promise<unknown>
  disableMfa: (currentPassword: string, totpCode: string) => Promise<unknown>
  regenerateRecoveryCodes: () => Promise<unknown>
  validateToken: () => Promise<unknown>
  refreshAccessToken: () => Promise<unknown>
}
