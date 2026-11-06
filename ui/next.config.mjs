// Signed-in and terminal pages are never shown inside another site's frame.
// Checkout pages under /i/ stay frameable for the BTCPay modal (public/modal/btcpay.js).
const noFramePaths = ["/dashboard", "/dashboard/:path*", "/login", "/welcome", "/terminal", "/terminal/:path*"];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      ...noFramePaths.map((source) => ({
        source,
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      })),
    ];
  },
};

export default nextConfig;
