import { offlineDb } from "@/lib/offline/db";

const LEGACY_BRIDGE_URL_KEY = "printer_bridge_url";
const QZ_HOST_KEY = "printer_qz_host";
const QZ_USE_SECURE_KEY = "printer_qz_use_secure";
const QZ_SECURE_PORTS_KEY = "printer_qz_secure_ports";
const QZ_INSECURE_PORTS_KEY = "printer_qz_insecure_ports";
const QZ_PRINTER_NAME_KEY = "printer_qz_printer_name";
const QZ_USE_SIGNING_KEY = "printer_qz_use_signing";
const QZ_SIGNING_MODE_KEY = "printer_qz_signing_mode";
const QZ_CERT_PEM_KEY = "printer_qz_cert_pem";
const QZ_SIGN_ENDPOINT_KEY = "printer_qz_sign_endpoint";
const QZ_CLIENT_PRIVATE_KEY_PEM_KEY = "printer_qz_client_private_key_pem";
const STORE_NAME_KEY = "printer_store_name";
const STORE_DESC_KEY = "printer_store_desc";
const FOOTER_MESSAGE_KEY = "printer_footer_message";

export type QzSigningMode = "unsigned" | "server" | "client";

export type PrinterBridgeSettings = {
  qzHost: string;
  qzUseSecure: boolean;
  qzSecurePorts: string;
  qzInsecurePorts: string;
  qzPrinterName: string;
  qzSigningMode: QzSigningMode;
  qzCertificatePem: string;
  qzSignEndpoint: string;
  qzClientPrivateKeyPem: string;
  storeName: string;
  storeDescription: string;
  footerMessage: string;
};

export const DEFAULT_PRINTER_BRIDGE_SETTINGS: PrinterBridgeSettings = {
  qzHost: "localhost",
  qzUseSecure: true,
  qzSecurePorts: "8181,8282,8383,8484",
  qzInsecurePorts: "8182,8283,8384,8485",
  qzPrinterName: "",
  qzSigningMode: "unsigned",
  qzCertificatePem: "",
  qzSignEndpoint: "",
  qzClientPrivateKeyPem: "",
  storeName: "ASIATEK POS",
  storeDescription: "Terima kasih sudah berbelanja",
  footerMessage: "Simpan struk ini sebagai bukti pembelian.",
};

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === "1") return true;
  if (value === "0") return false;
  return fallback;
}

function parseSigningMode(value: string | undefined): QzSigningMode | null {
  if (value === "unsigned" || value === "server" || value === "client") {
    return value;
  }
  return null;
}

function parsePortsCsv(value: string, fieldLabel: string) {
  const values = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (values.length === 0) {
    throw new Error(`${fieldLabel} tidak boleh kosong.`);
  }

  const parsed = values.map((item) => Number(item));
  if (parsed.some((item) => !Number.isInteger(item) || item < 1 || item > 65535)) {
    throw new Error(`${fieldLabel} harus berisi daftar port valid (1-65535).`);
  }

  return parsed.join(",");
}

function getLegacyBridgeUrlMigration(bridgeUrl?: string) {
  if (!bridgeUrl) return null;
  try {
    const parsed = new URL(bridgeUrl);
    if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") return null;

    const host = parsed.hostname || DEFAULT_PRINTER_BRIDGE_SETTINGS.qzHost;
    const port = parsed.port.trim();
    const useSecure = parsed.protocol === "wss:";

    return {
      qzHost: host,
      qzUseSecure: useSecure,
      qzSecurePorts: useSecure && port ? port : DEFAULT_PRINTER_BRIDGE_SETTINGS.qzSecurePorts,
      qzInsecurePorts:
        !useSecure && port ? port : DEFAULT_PRINTER_BRIDGE_SETTINGS.qzInsecurePorts,
    };
  } catch {
    return null;
  }
}

export async function loadPrinterBridgeSettings(): Promise<PrinterBridgeSettings> {
  const [
    legacyBridgeUrl,
    qzHost,
    qzUseSecure,
    qzSecurePorts,
    qzInsecurePorts,
    qzPrinterName,
    qzUseSigning,
    qzSigningMode,
    qzCertificatePem,
    qzSignEndpoint,
    qzClientPrivateKeyPem,
    storeName,
    storeDescription,
    footerMessage,
  ] = await Promise.all([
    offlineDb.appMeta.get(LEGACY_BRIDGE_URL_KEY),
    offlineDb.appMeta.get(QZ_HOST_KEY),
    offlineDb.appMeta.get(QZ_USE_SECURE_KEY),
    offlineDb.appMeta.get(QZ_SECURE_PORTS_KEY),
    offlineDb.appMeta.get(QZ_INSECURE_PORTS_KEY),
    offlineDb.appMeta.get(QZ_PRINTER_NAME_KEY),
    offlineDb.appMeta.get(QZ_USE_SIGNING_KEY),
    offlineDb.appMeta.get(QZ_SIGNING_MODE_KEY),
    offlineDb.appMeta.get(QZ_CERT_PEM_KEY),
    offlineDb.appMeta.get(QZ_SIGN_ENDPOINT_KEY),
    offlineDb.appMeta.get(QZ_CLIENT_PRIVATE_KEY_PEM_KEY),
    offlineDb.appMeta.get(STORE_NAME_KEY),
    offlineDb.appMeta.get(STORE_DESC_KEY),
    offlineDb.appMeta.get(FOOTER_MESSAGE_KEY),
  ]);

  const migration = getLegacyBridgeUrlMigration(legacyBridgeUrl?.value);
  const legacyUseSigning = parseBoolean(qzUseSigning?.value, false);
  const parsedMode = parseSigningMode(qzSigningMode?.value);
  const signingMode: QzSigningMode =
    parsedMode ?? (legacyUseSigning ? "server" : DEFAULT_PRINTER_BRIDGE_SETTINGS.qzSigningMode);

  return {
    qzHost: qzHost?.value?.trim() || migration?.qzHost || DEFAULT_PRINTER_BRIDGE_SETTINGS.qzHost,
    qzUseSecure: parseBoolean(
      qzUseSecure?.value,
      migration?.qzUseSecure ?? DEFAULT_PRINTER_BRIDGE_SETTINGS.qzUseSecure,
    ),
    qzSecurePorts:
      qzSecurePorts?.value?.trim() ||
      migration?.qzSecurePorts ||
      DEFAULT_PRINTER_BRIDGE_SETTINGS.qzSecurePorts,
    qzInsecurePorts:
      qzInsecurePorts?.value?.trim() ||
      migration?.qzInsecurePorts ||
      DEFAULT_PRINTER_BRIDGE_SETTINGS.qzInsecurePorts,
    qzPrinterName: qzPrinterName?.value?.trim() ?? DEFAULT_PRINTER_BRIDGE_SETTINGS.qzPrinterName,
    qzSigningMode: signingMode,
    qzCertificatePem: qzCertificatePem?.value ?? DEFAULT_PRINTER_BRIDGE_SETTINGS.qzCertificatePem,
    qzSignEndpoint:
      qzSignEndpoint?.value?.trim() ?? DEFAULT_PRINTER_BRIDGE_SETTINGS.qzSignEndpoint,
    qzClientPrivateKeyPem:
      qzClientPrivateKeyPem?.value ?? DEFAULT_PRINTER_BRIDGE_SETTINGS.qzClientPrivateKeyPem,
    storeName: storeName?.value ?? DEFAULT_PRINTER_BRIDGE_SETTINGS.storeName,
    storeDescription: storeDescription?.value ?? DEFAULT_PRINTER_BRIDGE_SETTINGS.storeDescription,
    footerMessage: footerMessage?.value ?? DEFAULT_PRINTER_BRIDGE_SETTINGS.footerMessage,
  };
}

export async function savePrinterBridgeSettings(input: PrinterBridgeSettings) {
  const normalizedSigningMode =
    parseSigningMode(input.qzSigningMode) ?? DEFAULT_PRINTER_BRIDGE_SETTINGS.qzSigningMode;

  const normalized: PrinterBridgeSettings = {
    qzHost: input.qzHost.trim() || DEFAULT_PRINTER_BRIDGE_SETTINGS.qzHost,
    qzUseSecure: Boolean(input.qzUseSecure),
    qzSecurePorts: parsePortsCsv(input.qzSecurePorts, "Port WSS"),
    qzInsecurePorts: parsePortsCsv(input.qzInsecurePorts, "Port WS"),
    qzPrinterName: input.qzPrinterName.trim(),
    qzSigningMode: normalizedSigningMode,
    qzCertificatePem: input.qzCertificatePem.trim(),
    qzSignEndpoint: input.qzSignEndpoint.trim(),
    qzClientPrivateKeyPem: input.qzClientPrivateKeyPem.trim(),
    storeName: input.storeName.trim() || DEFAULT_PRINTER_BRIDGE_SETTINGS.storeName,
    storeDescription:
      input.storeDescription.trim() || DEFAULT_PRINTER_BRIDGE_SETTINGS.storeDescription,
    footerMessage: input.footerMessage.trim() || DEFAULT_PRINTER_BRIDGE_SETTINGS.footerMessage,
  };

  if (!normalized.qzHost) {
    throw new Error("Host QZ Tray wajib diisi.");
  }

  if (normalized.qzSigningMode !== "unsigned" && !normalized.qzCertificatePem) {
    throw new Error("Certificate PEM wajib diisi jika mode signing aktif.");
  }

  if (normalized.qzSigningMode === "server") {
    if (!normalized.qzCertificatePem) {
      throw new Error("Certificate PEM wajib diisi jika mode server signing aktif.");
    }
    if (!normalized.qzSignEndpoint) {
      throw new Error("Sign endpoint wajib diisi jika mode server signing aktif.");
    }
    if (
      !normalized.qzSignEndpoint.startsWith("http://") &&
      !normalized.qzSignEndpoint.startsWith("https://")
    ) {
      throw new Error("Sign endpoint harus menggunakan http:// atau https://");
    }
  }

  if (normalized.qzSigningMode === "client" && !normalized.qzClientPrivateKeyPem) {
    throw new Error("Private key PEM wajib diisi jika mode client signing aktif.");
  }

  await Promise.all([
    offlineDb.appMeta.put({ key: QZ_HOST_KEY, value: normalized.qzHost }),
    offlineDb.appMeta.put({
      key: QZ_USE_SECURE_KEY,
      value: normalized.qzUseSecure ? "1" : "0",
    }),
    offlineDb.appMeta.put({ key: QZ_SECURE_PORTS_KEY, value: normalized.qzSecurePorts }),
    offlineDb.appMeta.put({ key: QZ_INSECURE_PORTS_KEY, value: normalized.qzInsecurePorts }),
    offlineDb.appMeta.put({ key: QZ_PRINTER_NAME_KEY, value: normalized.qzPrinterName }),
    offlineDb.appMeta.put({
      key: QZ_USE_SIGNING_KEY,
      value: normalized.qzSigningMode === "unsigned" ? "0" : "1",
    }),
    offlineDb.appMeta.put({ key: QZ_SIGNING_MODE_KEY, value: normalized.qzSigningMode }),
    offlineDb.appMeta.put({ key: QZ_CERT_PEM_KEY, value: normalized.qzCertificatePem }),
    offlineDb.appMeta.put({ key: QZ_SIGN_ENDPOINT_KEY, value: normalized.qzSignEndpoint }),
    offlineDb.appMeta.put({
      key: QZ_CLIENT_PRIVATE_KEY_PEM_KEY,
      value: normalized.qzClientPrivateKeyPem,
    }),
    offlineDb.appMeta.put({ key: STORE_NAME_KEY, value: normalized.storeName }),
    offlineDb.appMeta.put({ key: STORE_DESC_KEY, value: normalized.storeDescription }),
    offlineDb.appMeta.put({ key: FOOTER_MESSAGE_KEY, value: normalized.footerMessage }),
  ]);

  return normalized;
}
