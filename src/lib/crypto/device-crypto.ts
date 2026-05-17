const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

function toBase64(buffer: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(input: string) {
  return Uint8Array.from(atob(input), (char) => char.charCodeAt(0));
}

export async function encryptVerifier(
  verifier: string,
  password: string,
  iterations = 120_000,
) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(verifier),
  );

  return {
    encryptedVerifier: toBase64(encrypted),
    salt: toBase64(toArrayBuffer(salt)),
    iv: toBase64(toArrayBuffer(iv)),
    iterations,
  };
}

export async function decryptVerifier(params: {
  encryptedVerifier: string;
  password: string;
  salt: string;
  iv: string;
  iterations: number;
}) {
  const key = await deriveKey(params.password, fromBase64(params.salt), params.iterations);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(fromBase64(params.iv)) },
    key,
    toArrayBuffer(fromBase64(params.encryptedVerifier)),
  );
  return textDecoder.decode(decrypted);
}
