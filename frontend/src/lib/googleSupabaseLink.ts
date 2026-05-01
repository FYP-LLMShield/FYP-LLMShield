/**
 * Registers the Google ID token with Supabase Auth first so auth.identities shows provider "google".
 * Without this, admin-created users appear as "Email" only.
 *
 * Requires Authentication → Providers → Google enabled in Supabase with the same OAuth client ID.
 */
import { authAPI } from './api'
import { supabase, isSupabaseAuthAvailable } from './supabase'

export async function linkGoogleIdTokenToSupabaseAuth(idToken: string): Promise<boolean> {
  if (!isSupabaseAuthAvailable() || !supabase) return false
  try {
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    })
    if (error) {
      console.warn('[Google] Supabase signInWithIdToken:', error.message)
      return false
    }
    const { data } = await supabase.auth.getSession()
    const t = data?.session?.access_token
    if (t) {
      localStorage.setItem('access_token', t)
      authAPI.setToken(t)
    }
    await authAPI.syncPublicUser().catch((e) => console.warn('syncPublicUser:', e))
    return true
  } catch (e) {
    console.warn('[Google] linkGoogleIdTokenToSupabaseAuth:', e)
    return false
  }
}
