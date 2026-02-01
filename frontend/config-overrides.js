const { addWebpackAlias, override, overrideDevServer } = require('customize-cra');
const path = require('path');
const fs = require('fs');

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

// Override webpack configuration
const addWebpackConfig = () => (config) => {
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
    addWebpackConfig()
  ),
  devServer: overrideDevServer(devServerConfig())
};