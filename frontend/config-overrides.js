const { addWebpackAlias, override, overrideDevServer } = require('customize-cra');
const path = require('path');
const fs = require('fs');
const webpack = require('webpack');

// Load environment variables from root .env file
// Root .env is two levels up from frontend directory
const rootEnvPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(rootEnvPath)) {
  const envFile = fs.readFileSync(rootEnvPath, 'utf8');
  const lines = envFile.split('\n');
  
  lines.forEach(line => {
    // Only process REACT_APP_ variables (React requires this prefix)
    if (line.trim().startsWith('REACT_APP_')) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        // Set environment variable if not already set
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
}

// Custom resolve plugin: redirect any request for lib/utils to src/utils.ts (fixes Vercel "Can't resolve '../../lib/utils'")
class LibUtilsResolvePlugin {
  constructor(utilsPath) {
    this.utilsPath = utilsPath;
    this.utilsDir = path.dirname(utilsPath);
    this.utilsFile = path.basename(utilsPath);
  }
  apply(resolver) {
    const target = resolver.ensureHook("resolved");
    resolver
      .getHook("resolve")
      .tapAsync("LibUtilsResolvePlugin", (request, resolveContext, callback) => {
        const req = request.request;
        if (!req) return callback();
        const isLibUtils = req === "../../lib/utils" || req === "@/lib/utils" || /(^|\/)lib\/utils(\.[^/]*)?$/.test(req) || req.endsWith("lib/utils");
        if (!isLibUtils) return callback();
        const obj = { ...request, path: this.utilsPath, request: undefined };
        resolver.doResolve(target, obj, "lib/utils -> src/utils.ts", resolveContext, callback);
      });
  }
}

// Disable CSS minimizer to avoid "postcss-discard-comments requires PostCSS 8" (project uses PostCSS 7)
const disableCssMinimizer = (config) => {
  if (config.optimization && Array.isArray(config.optimization.minimizer)) {
    config.optimization.minimizer = config.optimization.minimizer.filter(
      (plugin) => plugin.constructor.name !== "CssMinimizerPlugin"
    );
  }
  return config;
};

// Override webpack configuration
const addWebpackConfig = () => (config) => {
  const srcDir = path.resolve(__dirname, 'src');
  const utilsPath = path.resolve(srcDir, 'utils.ts');
  config.resolve = config.resolve || {};
  config.resolve.alias = config.resolve.alias || {};
  config.resolve.alias['../../lib/utils'] = utilsPath;
  config.resolve.alias['../../lib/utils.js'] = utilsPath;
  config.resolve.alias['../../lib/utils.ts'] = utilsPath;
  config.resolve.alias[path.resolve(srcDir, 'lib', 'utils')] = utilsPath;
  config.resolve.alias['@/lib/utils'] = utilsPath;
  config.resolve.plugins = config.resolve.plugins || [];
  config.resolve.plugins.push(new LibUtilsResolvePlugin(utilsPath));
  config.plugins = config.plugins || [];
  config.plugins.push(
    new webpack.NormalModuleReplacementPlugin(
      /[\\/]lib[\\/]utils(\.[^\\/]*)?$/,
      utilsPath
    )
  );
  return config;
};

// Override dev server configuration to suppress deprecation warnings
const devServerConfig = () => (config) => {
  // Remove deprecated middleware options if they exist
  delete config.onAfterSetupMiddleware;
  delete config.onBeforeSetupMiddleware;
  
  // Use the new setupMiddlewares option instead
  config.setupMiddlewares = (middlewares, devServer) => {
    // Add any custom middleware here if needed
    return middlewares;
  };
  
  return config;
};

module.exports = {
  webpack: override(
    addWebpackAlias({
      '@': path.resolve(__dirname, 'src'),
    }),
    addWebpackConfig(),
    disableCssMinimizer
  ),
  devServer: overrideDevServer(devServerConfig())
};