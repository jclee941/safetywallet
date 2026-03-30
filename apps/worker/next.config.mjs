import withPWA from "next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "/api",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "",
  },
};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: ({ url, request }) =>
        request.method === "GET" && url.pathname.startsWith("/api/"),
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "api-runtime-cache",
        expiration: {
          maxAgeSeconds: 60 * 5,
        },
      },
    },
    {
      urlPattern: ({ request }) => request.destination === "image",
      handler: "CacheFirst",
      options: {
        cacheName: "image-runtime-cache",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
    {
      urlPattern: ({ request }) => request.mode === "navigate",
      handler: "NetworkFirst",
      options: {
        cacheName: "navigation-runtime-cache",
        networkTimeoutSeconds: 3,
      },
    },
  ],
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
