/**
 * Masking helpers for log output. Keeps PII / secrets out of logs (NFR-U1-5).
 */

/**
 * Mask a string, revealing only the first and last character for context.
 * `maskString('secret')` → `s****t`. Short strings are fully masked.
 */
export function maskString(value: string | null | undefined): string {
  if (!value) return '';
  if (value.length <= 2) return '*'.repeat(value.length);
  return `${value[0]}${'*'.repeat(Math.max(1, value.length - 2))}${value[value.length - 1]}`;
}

/** Mask an email as `j****e@d****n.com` style — enough to correlate, not to leak. */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!domain) return maskString(email);
  return `${maskString(local)}@${maskString(domain)}`;
}
