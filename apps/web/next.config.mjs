/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @contextio/shared is a workspace package shipped as TS/ESM; transpile it.
  transpilePackages: ["@contextio/shared"],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
