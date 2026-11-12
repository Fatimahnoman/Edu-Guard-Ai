/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker/self-hosted builds need standalone output; Vercel does not use it.
  // Set DOCKER_BUILD=1 in the Dockerfile builder stage to enable it there only.
  output: process.env.DOCKER_BUILD ? "standalone" : undefined,
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;