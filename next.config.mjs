/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allows running correctly behind a reverse proxy (nginx) that sets
  // X-Forwarded-* headers. Cookie "secure" flag is controlled via SECURE_COOKIES.
  poweredByHeader: false,
};

export default nextConfig;
