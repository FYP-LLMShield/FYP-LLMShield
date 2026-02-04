import { useEffect, useRef } from 'react'

/**
 * Custom hook for auto-scrolling to bottom of a container
 * Usage: const ref = useAutoScroll(deps)
 */
export function useAutoScroll<T extends HTMLElement>(deps: unknown[] = []) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    // Use requestAnimationFrame for smooth scrolling
    const frame = requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight
    })

    return () => cancelAnimationFrame(frame)
  }, deps)

  return ref
}
