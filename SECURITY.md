# Security & Dependencies

## What are Dependabot / npm audit vulnerabilities?

**Dependabot** (on GitHub) and **npm audit** scan your dependencies for known security issues (CVEs). When a library you use—or a library *used by* that library—has a reported vulnerability, they flag it so you can update or mitigate.

- **High** – Should be fixed soon; often exploitable in realistic scenarios.
- **Moderate** – Worth fixing; impact or exploitability is lower.
- **Low** – Minor risk; fix when convenient.

## What we’ve done in this project

1. **Safe fixes applied**  
   In the **frontend** we ran `npm audit fix`, which:
   - Updated packages to patched versions where possible without breaking changes.
   - Reduced the number of reported vulnerabilities (e.g. from 66 to ~53 in the frontend).

2. **React Router**  
   `react-router-dom` is set to `^7.12.0` so we use a version that includes security fixes for the previously reported issues.

3. **Remaining issues**  
   Some vulnerabilities are in **transitive** dependencies (dependencies of your dependencies), especially:
   - **react-scripts** (Create React App) and its dependency chain (e.g. webpack-dev-server, svgo, postcss).
   - Fixing these would require either:
     - `npm audit fix --force` (which can break the build by downgrading react-scripts), or
     - Migrating off Create React App to a different build setup (e.g. Vite).

   For a typical FYP deployment, the remaining issues are mostly in **dev/build-time** tools. They don’t ship to the browser in the same way your app code does, but it’s still good practice to reduce them over time.

## What you can do

- **Frontend**  
  From the project root:
  ```bash
  cd frontend
  npm audit
  npm audit fix
  ```
  Only use `npm audit fix --force` if you’re prepared to fix possible build breakage.

- **Backend**  
  If you use Python (e.g. `requirements.txt`), keep dependencies updated and check:
  ```bash
  pip list --outdated
  ```

- **GitHub**  
  Review and merge [Dependabot pull requests](https://github.com/FYP-LLMShield/FYP-LLMShield/security/dependabot) when they don’t break the build. You can enable Dependabot in **Settings → Security → Code security and analysis**.

## Reporting a security issue

If you find a security vulnerability in this project, please report it responsibly (e.g. via your course coordinator or repository owner) rather than opening a public issue.
