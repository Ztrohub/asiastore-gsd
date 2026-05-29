import type { PrinterBridgeSettings } from "@/features/pos/lib/printer-bridge-settings";

export type QzModule = typeof import("qz-tray");

type QzWithDefault = QzModule & {
  default?: QzModule;
};

let qzModulePromise: Promise<QzModule> | null = null;
let jsrsasignPromise: Promise<typeof import("jsrsasign")> | null = null;

export function parsePortsCsv(value: string, fieldLabel: string) {
  const values = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (values.length === 0) {
    throw new Error(`${fieldLabel} kosong.`);
  }

  const parsed = values.map((item) => Number(item));
  if (parsed.some((item) => !Number.isInteger(item) || item < 1 || item > 65535)) {
    throw new Error(`${fieldLabel} tidak valid.`);
  }
  return parsed;
}

async function loadQzModule() {
  if (!qzModulePromise) {
    qzModulePromise = import("qz-tray").then((module) => {
      const normalized = module as QzWithDefault;
      return normalized.default ?? normalized;
    });
  }
  return qzModulePromise;
}

async function loadJsrsasign() {
  if (!jsrsasignPromise) {
    jsrsasignPromise = import("jsrsasign");
  }
  return jsrsasignPromise;
}

async function signWithPrivateKey(dataToSign: string, privateKeyPem: string) {
  const rs = await loadJsrsasign();
  const privateKey = rs.KEYUTIL.getKey(privateKeyPem);
  const signature = new rs.KJUR.crypto.Signature({ alg: "SHA512withRSA" });
  signature.init(privateKey);
  signature.updateString(dataToSign);
  return rs.hextob64(signature.sign());
}

export function configureQzSecurity(qz: QzModule, settings: PrinterBridgeSettings) {
  const signingMode = settings.qzSigningMode;

  if (signingMode === "unsigned") {
    qz.security.setCertificatePromise((resolve) => resolve(undefined), {
      rejectOnFailure: false,
    });
    qz.security.setSignaturePromise(() => (resolve) => resolve(""));
    return;
  }

  const certPem = settings.qzCertificatePem.trim();
  if (!certPem) {
    throw new Error("Mode signing aktif, tetapi certificate belum diisi.");
  }

  qz.security.setCertificatePromise((resolve) => resolve(certPem), {
    rejectOnFailure: true,
  });
  qz.security.setSignatureAlgorithm("SHA512");

  if (signingMode === "server") {
    const signEndpoint = settings.qzSignEndpoint.trim();
    if (!signEndpoint) {
      throw new Error("Sign endpoint belum diisi untuk mode server signing.");
    }

    qz.security.setSignaturePromise((dataToSign) => (resolve, reject) => {
      fetch(signEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataToSign }),
      })
        .then(async (response) => {
          if (!response.ok) {
            reject("Sign endpoint menolak request.");
            return;
          }
          let body: { signature?: string } = {};
          try {
            body = (await response.json()) as { signature?: string };
          } catch {
            body = {};
          }
          const signature = body.signature?.trim();
          if (!signature) {
            reject("Sign endpoint tidak mengembalikan signature.");
            return;
          }
          resolve(signature);
        })
        .catch((err) => {
          if (err instanceof Error) {
            reject(err.message);
            return;
          }
          reject("Gagal memanggil sign endpoint.");
        });
    });
    return;
  }

  if (signingMode === "client") {
    const privateKeyPem = settings.qzClientPrivateKeyPem.trim();
    if (!privateKeyPem) {
      throw new Error("Private key PEM belum diisi untuk mode client signing.");
    }

    qz.security.setSignaturePromise((dataToSign) => (resolve, reject) => {
      signWithPrivateKey(dataToSign, privateKeyPem)
        .then((signature) => resolve(signature))
        .catch((err) => {
          if (err instanceof Error) {
            reject(err.message);
            return;
          }
          reject("Gagal melakukan client-side signing.");
        });
    });
    return;
  }

  throw new Error("Mode signing tidak dikenali.");
}

function pickPrinterName(result: string | string[]) {
  if (Array.isArray(result)) {
    return result[0] ?? "";
  }
  return result ?? "";
}

export async function resolveQzPrinterName(qz: QzModule, settings: PrinterBridgeSettings) {
  const query = settings.qzPrinterName.trim();
  if (query) {
    const found = pickPrinterName(await qz.printers.find(query));
    if (!found) {
      throw new Error(`Printer "${query}" tidak ditemukan.`);
    }
    return found;
  }

  const fromDefault = await qz.printers.getDefault();
  if (fromDefault?.trim()) {
    return fromDefault;
  }

  const fromAll = pickPrinterName(await qz.printers.find());
  if (fromAll) {
    return fromAll;
  }

  throw new Error("Tidak ada printer yang tersedia di QZ Tray.");
}

export async function connectQzTray(settings: PrinterBridgeSettings) {
  const qzHost = settings.qzHost.trim();
  if (!qzHost) {
    throw new Error("Host QZ Tray belum diatur.");
  }

  const securePorts = parsePortsCsv(settings.qzSecurePorts, "Port WSS");
  const insecurePorts = parsePortsCsv(settings.qzInsecurePorts, "Port WS");
  const qz = await loadQzModule();

  configureQzSecurity(qz, settings);

  const wasConnected = qz.websocket.isActive();
  if (!wasConnected) {
    await qz.websocket.connect({
      host: qzHost,
      usingSecure: settings.qzUseSecure,
      port: {
        secure: securePorts,
        insecure: insecurePorts,
      },
      retries: 0,
      delay: 0,
    });
  }

  async function disconnectIfNeeded() {
    if (!wasConnected && qz.websocket.isActive()) {
      await qz.websocket.disconnect().catch(() => undefined);
    }
  }

  return { qz, disconnectIfNeeded };
}

export async function listQzPrinters(qz: QzModule) {
  const found = await qz.printers.find();
  if (Array.isArray(found)) return found.filter(Boolean);
  return found ? [found] : [];
}
