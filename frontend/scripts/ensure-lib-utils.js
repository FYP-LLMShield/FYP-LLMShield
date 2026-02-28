/**
 * Ensures src/lib/utils.ts exists before build (fixes Vercel "Can't resolve '../../lib/utils'").
 * Writes full cn implementation so the file works even when gitignore omits it.
 */
const path = require("path");
const fs = require("fs");

const frontendRoot = path.resolve(__dirname, "..");
const libDir = path.join(frontendRoot, "src", "lib");
const utilsPath = path.join(libDir, "utils.ts");
const content = `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;

if (!fs.existsSync(utilsPath)) {
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }
  fs.writeFileSync(utilsPath, content, "utf8");
  console.log("Created src/lib/utils.ts for build.");
}
