/**
 * Supabase client for Auth (primary). When Supabase is unavailable, app uses backend auth as fallback.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || ''
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || ''

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export function isSupabaseAuthAvailable() {
  return !!supabase
}

/**
 * Detect if an error from Supabase indicates the service is down/unavailable (so we should fallback to backend).
 */
export function isSupabaseUnavailableError(error) {
  if (!error) return false
  const msg = (error.message || String(error)).toLowerCase()
  // Network/connection failures
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) return true
  if (msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('enotfound')) return true
  // Supabase 5xx or connection errors (AuthApiError has .status)
  const status = error.status ?? error.code
  if (typeof status === 'number' && status >= 500) return true
  if (status === 'ECONNREFUSED' || status === 'ETIMEDOUT' || status === 'ENOTFOUND') return true
  return false
}
