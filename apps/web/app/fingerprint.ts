"use client";

// Zero-friction identity (spec §3): a random id kept in localStorage. No login.
// ponytail: random UUID is enough to key a device. Swap for FingerprintJS only if
// you need cross-reinstall identity (and accept the privacy tradeoff).
export function getFingerprint(): string {
  if (typeof window === "undefined") return "";
  let fp = localStorage.getItem("fingerprint");
  if (!fp) {
    fp = crypto.randomUUID();
    localStorage.setItem("fingerprint", fp);
  }
  return fp;
}
