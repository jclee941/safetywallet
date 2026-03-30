const NONCE_BYTES = 16;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function generateNonce(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(NONCE_BYTES)));
}

export function buildHtmlCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://static.cloudflareinsights.com https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "connect-src 'self' https:",
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function buildApiCsp(): string {
  return [
    "default-src 'self'",
    "script-src 'self' https://static.cloudflareinsights.com",
    "style-src 'self'",
    "img-src 'self' blob: data: https:",
    "connect-src 'self' https:",
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
    "frame-ancestors 'none'",
  ].join("; ");
}
