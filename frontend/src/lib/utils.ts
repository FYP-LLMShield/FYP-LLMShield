import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines clsx and tailwind-merge for conditional class names.
 * Used by UI components in src/components/ui/.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
