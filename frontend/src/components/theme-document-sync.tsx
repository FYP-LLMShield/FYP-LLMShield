import { useEffect } from "react"
import { useTheme } from "../contexts/ThemeContext"

/**
 * Keeps the global CSS variable theme in sync with the dashboard theme toggle
 * by applying `dark` to `<html>` (see `index.css` `.dark { --background: ... }`).
 */
export function ThemeDocumentSync() {
  const { theme } = useTheme()

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove("light", "dark")
    if (theme === "dark") {
      root.classList.add("dark")
    }
  }, [theme])

  return null
}
