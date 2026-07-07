/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allows running correctly behind a reverse proxy (nginx) that sets
  // X-Forwarded-* headers. Cookie "secure" flag is controlled via SECURE_COOKIES.
  poweredByHeader: false,
  // Don't fail the production build on lint. There is no committed ESLint
  // config, so `next build` falls back to a default that lacks the Next.js
  // plugin and flags valid App Router patterns (e.g. `export const metadata`)
  // as errors. Type-checking still runs and will fail the build on real errors.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
