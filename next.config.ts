import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Fix turbopack workspace-root warning
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Allow Shopify CDN images + other sources
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.myshopify.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "drive.google.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
