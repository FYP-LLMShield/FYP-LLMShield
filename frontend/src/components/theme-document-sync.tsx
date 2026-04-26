import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { useTheme } from "../contexts/ThemeContext"

/** Applies `dark` on <html> for marketing/auth; applies saved theme only under `/dashboard`. */
export function ThemeDocumentSync() {
  const location = useLocation()
  const { theme } = useTheme()

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove("light", "dark")

    const onDashboard = location.pathname.startsWith("/dashboard")
    if (!onDashboard) {
      root.classList.add("dark")
      return
    }

    if (theme === "dark") {
      root.classList.add("dark")
    }
  }, [location.pathname, theme])

  return null
}
