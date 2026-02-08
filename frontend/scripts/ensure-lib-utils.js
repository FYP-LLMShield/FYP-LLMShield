/**
 * Ensures frontend/src/lib/utils.ts exists before build (fixes Vercel "Can't resolve '../../lib/utils'").
 * Run before build so the file exists even when gitignore or deploy omits it.
 */
const path = require("path");
const fs = require("fs");

const frontendRoot = path.resolve(__dirname, "..");
const libDir = path.join(frontendRoot, "src", "lib");
const utilsPath = path.join(libDir, "utils.ts");
const content = 'export { cn } from "../utils";\n';

if (!fs.existsSync(utilsPath)) {
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }
  fs.writeFileSync(utilsPath, content, "utf8");
  console.log("Created src/lib/utils.ts for build.");
}
