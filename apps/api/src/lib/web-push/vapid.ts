/**
 * VAPID JWT generation and key management.
 */

import { base64urlDecode, base64urlEncode } from "./encryption";

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

export async function createVapidJwt(
  audience: string,
  subject: string,
  vapidPrivateKey: string,
  expSeconds: number = 12 * 60 * 60,
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + expSeconds, sub: subject };

  const headerB64 = base64urlEncode(
    new TextEncoder().encode(JSON.stringify(header)),
  );
  const payloadB64 = base64urlEncode(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const signingKey = await importEcdsaPrivateKey(
    base64urlDecode(vapidPrivateKey),
  );

  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    signingKey,
    new TextEncoder().encode(unsignedToken),
  );

  return `${unsignedToken}.${base64urlEncode(signatureBuffer)}`;
}

export async function generateVapidKeys(): Promise<VapidKeys> {
  const keyPair = (await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"],
  )) as CryptoKeyPair;

  const publicKeyRaw = (await crypto.subtle.exportKey(
    "raw",
    keyPair.publicKey,
  )) as ArrayBuffer;
  const privateKeyJwk = (await crypto.subtle.exportKey(
    "jwk",
    keyPair.privateKey,
  )) as JsonWebKey;

  return {
    publicKey: base64urlEncode(publicKeyRaw),
    privateKey: privateKeyJwk.d!,
  };
}

/**
 * Import raw P-256 private key (32 bytes) for ECDSA signing.
 * Derives public key coords via ECDH PKCS8 import+export, then re-imports as ECDSA JWK.
 */
async function importEcdsaPrivateKey(
  rawPrivateKey: Uint8Array,
): Promise<CryptoKey> {
  const { x, y } = await deriveP256PublicKey(rawPrivateKey);

  return crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      d: base64urlEncode(rawPrivateKey),
      x: base64urlEncode(x),
      y: base64urlEncode(y),
      ext: true,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

/**
 * Derive P-256 public key (x, y) from raw 32-byte private key.
 * Imports as ECDH via minimal PKCS8 DER, exports JWK to get x,y.
 */
async function deriveP256PublicKey(
  rawPrivateKey: Uint8Array,
): Promise<{ x: Uint8Array; y: Uint8Array }> {
  const pkcs8Prefix = new Uint8Array([
    0x30, 0x4d, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
    0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x33, 0x30, 0x31, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);

  const pkcs8Der = new Uint8Array(pkcs8Prefix.length + rawPrivateKey.length);
  pkcs8Der.set(pkcs8Prefix);
  pkcs8Der.set(rawPrivateKey, pkcs8Prefix.length);

  const ecdhKey = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8Der.buffer,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );

  const exportedJwk = (await crypto.subtle.exportKey(
    "jwk",
    ecdhKey,
  )) as JsonWebKey;
  return {
    x: base64urlDecode(exportedJwk.x!),
    y: base64urlDecode(exportedJwk.y!),
  };
}
