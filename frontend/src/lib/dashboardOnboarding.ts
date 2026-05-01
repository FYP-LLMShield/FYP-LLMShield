/**
 * Session keys for Security Dashboard welcome + MFA hint modals (main-dashboard.tsx).
 * Clear these after a new account is created so the next /dashboard visit shows the flow again.
 */
const WELCOME_SEEN_KEY = 'welcomePopupShown'
const MFA_DISMISSED_KEY = 'mfaPromptDismissed'

export function resetDashboardOnboardingSession(): void {
  try {
    sessionStorage.removeItem(WELCOME_SEEN_KEY)
    sessionStorage.removeItem(MFA_DISMISSED_KEY)
  } catch {
    /* ignore */
  }
}
