import type { NextConfig } from "next";

function apiProxyTarget() {
  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const configured =
    process.env.API_PROXY_TARGET ||
    (publicApiUrl && !publicApiUrl.startsWith("/") ? publicApiUrl : undefined) ||
    process.env.RAILWAY_SERVICE_WHITEBOX_API_URL ||
    "http://localhost:3001/api";
  const withProtocol =
    configured.startsWith("http://") || configured.startsWith("https://") || configured.startsWith("/")
      ? configured
      : `https://${configured}`;
  if (withProtocol.startsWith("/")) return "http://localhost:3001/api";
  const target = new URL(withProtocol);
  if (target.pathname === "/") target.pathname = "/api";
  return target.toString().replace(/\/$/, "");
}

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/backend-api/:path*",
          destination: `${apiProxyTarget()}/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
