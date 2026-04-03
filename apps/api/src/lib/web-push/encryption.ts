/**
 * RFC 8291 payload encryption utilities (aes128gcm) for Web Push.
 */

export function base64urlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encryptPayload(
  plaintext: string,
  clientPublicKeyB64: string,
  authSecretB64: string,
): Promise<{ encrypted: Uint8Array; serverPublicKey: Uint8Array }> {
  const clientPublicKeyBytes = base64urlDecode(clientPublicKeyB64);
  const authSecret = base64urlDecode(authSecretB64);

  const serverKeyPair = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;

  const serverPublicKeyRaw = (await crypto.subtle.exportKey(
    "raw",
    serverKeyPair.publicKey,
  )) as ArrayBuffer;
  const serverPublicKey = new Uint8Array(serverPublicKeyRaw);

  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKeyBytes as unknown as ArrayBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );

  const sharedSecretBits = await crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: clientPublicKey,
    } as unknown as SubtleCryptoDeriveKeyAlgorithm,
    serverKeyPair.privateKey,
    256,
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  const ikm = await hkdfDerive(
    authSecret,
    sharedSecret,
    buildInfo("WebPush: info", clientPublicKeyBytes, serverPublicKey),
    32,
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const cek = await hkdfDerive(
    salt,
    ikm,
    buildCeInfo("Content-Encoding: aes128gcm"),
    16,
  );
  const nonce = await hkdfDerive(
    salt,
    ikm,
    buildCeInfo("Content-Encoding: nonce"),
    12,
  );

  const plaintextBytes = new TextEncoder().encode(plaintext);
  const paddedPlaintext = new Uint8Array(plaintextBytes.length + 1);
  paddedPlaintext.set(plaintextBytes);
  paddedPlaintext[plaintextBytes.length] = 0x02;

  const cekKey = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, tagLength: 128 },
    cekKey,
    paddedPlaintext,
  );

  const recordSize = 4096;
  const header = new Uint8Array(16 + 4 + 1 + serverPublicKey.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, recordSize, false);
  header[20] = serverPublicKey.length;
  header.set(serverPublicKey, 21);

  const encrypted = new Uint8Array(header.length + ciphertext.byteLength);
  encrypted.set(header, 0);
  encrypted.set(new Uint8Array(ciphertext), header.length);

  return { encrypted, serverPublicKey };
}

function buildInfo(
  label: string,
  clientPublicKey: Uint8Array,
  serverPublicKey: Uint8Array,
): Uint8Array {
  const labelBytes = new TextEncoder().encode(label);
  const info = new Uint8Array(
    labelBytes.length + 1 + clientPublicKey.length + serverPublicKey.length,
  );
  info.set(labelBytes, 0);
  info[labelBytes.length] = 0x00;
  info.set(clientPublicKey, labelBytes.length + 1);
  info.set(serverPublicKey, labelBytes.length + 1 + clientPublicKey.length);
  return info;
}

function buildCeInfo(label: string): Uint8Array {
  const labelBytes = new TextEncoder().encode(label);
  const info = new Uint8Array(labelBytes.length + 1);
  info.set(labelBytes, 0);
  info[labelBytes.length] = 0x00;
  return info;
}

async function hkdfDerive(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const ikmKey = await crypto.subtle.importKey(
    "raw",
    ikm,
    { name: "HKDF" },
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    ikmKey,
    length * 8,
  );

  return new Uint8Array(derivedBits);
}
