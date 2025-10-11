const { addWebpackAlias, override, overrideDevServer } = require('customize-cra');
const path = require('path');

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