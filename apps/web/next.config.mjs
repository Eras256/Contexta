/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @contexta/shared is a workspace package shipped as TS/ESM; transpile it.
  transpilePackages: ["@contexta/shared"],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
