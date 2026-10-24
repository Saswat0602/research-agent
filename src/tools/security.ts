import { URL } from "node:url";
import net from "node:net";

export class SSRFSecurityError extends Error {
  constructor(message: string, public readonly targetUrl: string) {
    super(`SSRF Security Violation: ${message} (Target: ${targetUrl})`);
    this.name = "SSRFSecurityError";
  }
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const [b0, b1] = parts;

    // Loopback 127.0.0.0/8
    if (b0 === 127) return true;

    // Zero address 0.0.0.0/8
    if (b0 === 0) return true;

    // Private RFC 1918
    // 10.0.0.0/8
    if (b0 === 10) return true;

    // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

    // 192.168.0.0/16
    if (b0 === 192 && b1 === 168) return true;

    // Link-local / Cloud metadata: 169.254.0.0/16 (AWS/GCP/Azure)
    if (b0 === 169 && b1 === 254) return true;

    // Broadcast
    if (ip === "255.255.255.255") return true;

    return false;
  }

  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    // Loopback
    if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;
    // Unspecified
    if (lower === "::" || lower === "0:0:0:0:0:0:0:0") return true;
    // Unique local address fc00::/7
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    // Link-local fe80::/10
    if (lower.startsWith("fe80")) return true;
    return false;
  }

  return false;
}

export function validateUrlSecurity(urlString: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new SSRFSecurityError("Malformed URL structure", urlString);
  }

  // Only allow standard web protocols
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SSRFSecurityError(
      `Disallowed protocol '${parsed.protocol}'. Only http: and https: are permitted.`,
      urlString
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost and standard loopback hostnames
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "local" ||
    hostname.endsWith(".local")
  ) {
    throw new SSRFSecurityError("Access to localhost domain is prohibited", urlString);
  }

  // Block cloud metadata provider domains
  if (
    hostname === "metadata.google.internal" ||
    hostname.endsWith(".metadata.google.internal") ||
    hostname === "metadata" ||
    hostname === "instance-data"
  ) {
    throw new SSRFSecurityError("Access to cloud metadata endpoints is prohibited", urlString);
  }

  // Block direct IP accesses to private / internal ranges
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new SSRFSecurityError(
        `Direct access to private/internal IP address '${hostname}' is prohibited`,
        urlString
      );
    }
  }

  return parsed;
}

export function sanitizeExternalText(rawText: string, maxLength = 8000): string {
  if (!rawText) return "";

  return rawText
    .slice(0, maxLength)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/\r\n/g, "\n")
    .trim();
}
