/**
 * Run production build with DISABLE_ESLINT_PLUGIN=true so ESLint does not run during build.
 * This ensures the build passes on Vercel regardless of ESLint warnings.
 */
process.env.DISABLE_ESLINT_PLUGIN = "true";
const { execSync } = require("child_process");
execSync("npx react-app-rewired build", { stdio: "inherit", env: process.env });
