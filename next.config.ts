import type { NextConfig } from "next";

// NEXT_PUBLIC_BASE_PATH is injected at build time:
//   - locally via .env.development (empty string = runs at /)
//   - in Docker via ENV NEXT_PUBLIC_BASE_PATH=/apps/<project-id> in Dockerfile
//   - the deploy script sets it as a build ARG so it is baked into the image
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath,
  // assetPrefix must match basePath so static assets resolve correctly
  // behind the nginx reverse proxy that serves the app at the subpath.
  assetPrefix: basePath,
  turbopack: {
    root: __dirname,
  },
  experimental: {},
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
