import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateUrlSecurity, sanitizeExternalText, SSRFSecurityError } from "../../src/tools/security.js";

describe("Security: SSRF Defense & URL Validation", () => {
  test("allows valid public HTTPS and HTTP URLs", () => {
    const valid1 = validateUrlSecurity("https://github.com/google/adk-js");
    assert.equal(valid1.hostname, "github.com");

    const valid2 = validateUrlSecurity("https://ai.google.dev/gemini-api");
    assert.equal(valid2.hostname, "ai.google.dev");
  });

  test("blocks localhost and loopback domains", () => {
    assert.throws(
      () => validateUrlSecurity("http://localhost:3000/api"),
      (err: Error) => err instanceof SSRFSecurityError && err.message.includes("localhost")
    );

    assert.throws(
      () => validateUrlSecurity("http://127.0.0.1:5432"),
      (err: Error) => err instanceof SSRFSecurityError && err.message.includes("private/internal IP")
    );
  });

  test("blocks cloud metadata service endpoints (AWS / GCP)", () => {
    assert.throws(
      () => validateUrlSecurity("http://169.254.169.254/latest/meta-data"),
      (err: Error) => err instanceof SSRFSecurityError
    );

    assert.throws(
      () => validateUrlSecurity("http://metadata.google.internal/computeMetadata/v1/"),
      (err: Error) => err instanceof SSRFSecurityError && err.message.includes("metadata")
    );
  });

  test("blocks private RFC 1918 IPv4 ranges", () => {
    assert.throws(() => validateUrlSecurity("http://10.0.0.1/admin"), SSRFSecurityError);
    assert.throws(() => validateUrlSecurity("http://192.168.1.1/router"), SSRFSecurityError);
    assert.throws(() => validateUrlSecurity("http://172.16.0.5/internal"), SSRFSecurityError);
  });

  test("blocks non-HTTP protocols", () => {
    assert.throws(
      () => validateUrlSecurity("file:///etc/passwd"),
      (err: Error) => err instanceof SSRFSecurityError && err.message.includes("Disallowed protocol")
    );

    assert.throws(
      () => validateUrlSecurity("ftp://ftp.example.com/data"),
      (err: Error) => err instanceof SSRFSecurityError
    );
  });

  test("sanitizes untrusted external text and strips scripts", () => {
    const dirty = "Article text <script>alert('pwned')</script> and normal content.";
    const cleaned = sanitizeExternalText(dirty);
    assert.ok(!cleaned.includes("<script>"));
    assert.ok(cleaned.includes("Article text"));
    assert.ok(cleaned.includes("and normal content."));
  });
});
