import type { NextConfig } from "next";

const isHostingerPreview = process.env.HOSTINGER_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(isHostingerPreview ? { output: "export", trailingSlash: true } : {}),
  images: {
    unoptimized: isHostingerPreview,
  },
};

export default nextConfig;
