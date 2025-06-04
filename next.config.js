/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    DEFAULT_LLM_PROVIDER: process.env.DEFAULT_LLM_PROVIDER,
    DEFAULT_LLM_MODEL: process.env.DEFAULT_LLM_MODEL,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Ignore node modules on client
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;