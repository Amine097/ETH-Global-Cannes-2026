/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["stavable-untributarily-rebbecca.ngrok-free.dev"],
  reactStrictMode: false,
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "pino-pretty": false,
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
};

export default nextConfig;
