/**
 * GitHub OAuth via Supabase Auth (redirect flow).
 * Requires Authentication → Providers → GitHub enabled in Supabase.
 */

export const GITHUB_AUTH_MODE_KEY = 'llmshield_github_auth_mode'

export async function startGitHubOAuthRedirect(
  flowMode: 'signup' | 'signin' = 'signup'
): Promise<void> {
  const { supabase } = await import('./supabase')
  if (!supabase) {
    throw new Error('Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.')
  }
  sessionStorage.setItem(GITHUB_AUTH_MODE_KEY, flowMode)
  const redirectTo = `${window.location.origin}/auth`
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo,
      scopes: 'read:user user:email',
    },
  })
  if (error) {
    sessionStorage.removeItem(GITHUB_AUTH_MODE_KEY)
    throw error
  }
  if (data?.url) {
    window.location.href = data.url
  } else {
    sessionStorage.removeItem(GITHUB_AUTH_MODE_KEY)
    throw new Error('GitHub sign-in did not return a redirect URL')
  }
}
