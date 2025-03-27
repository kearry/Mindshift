// next.config.ts
import type { NextConfig } from 'next';
import type { Configuration as WebpackConfig } from 'webpack'; // Import webpack type

const nextConfig: NextConfig = {
  // Keep any existing configurations you might have
  reactStrictMode: true, // Example existing config

  webpack: (
    config: WebpackConfig, // Add type for config
    { isServer }: { isServer: boolean } // Add type for isServer object
  ) => {
    // Exclude 'fs' module from client-side bundles
    if (!isServer) {
      config.resolve = config.resolve || {}; // Ensure resolve object exists
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}), // Spread existing fallback if needed
        fs: false, // Tell webpack to ignore 'fs' on the client
      };
    }

    // Important: return the modified config
    return config;
  },
};

export default nextConfig;