import { randomUUID } from 'node:crypto';

/**
 * Pure storage-key build/parse helpers (BR-WS5, FL-8). Key shape:
 *   submittals/<projectId>/<creditId>/<slotKey>/<uuid>__<safeFileName>
 */

const KEY_RE =
  /^submittals\/([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9_-]+)\/([a-z0-9-]+)__([a-z0-9._-]+)$/i;

export interface ParsedKey {
  projectId: string;
  creditId: string;
  slotKey: string;
  uuid: string;
  safeFileName: string;
}

export function buildKey(
  projectId: string,
  creditId: string,
  slotKey: string,
  safeFileName: string,
  uuid: string = randomUUID(),
): string {
  return `submittals/${projectId}/${creditId}/${slotKey}/${uuid}__${safeFileName}`;
}

export function parseKey(key: string): ParsedKey | null {
  const match = KEY_RE.exec(key);
  if (!match) return null;
  return {
    projectId: match[1],
    creditId: match[2],
    slotKey: match[3],
    uuid: match[4],
    safeFileName: match[5],
  };
}

export function isValidKey(key: string): boolean {
  return KEY_RE.test(key);
}

/** Filename sanitization per BR-WS3. */
export function sanitizeFileName(original: string): string {
  const base = original.replace(/[/\\]/g, '_').normalize('NFC');
  const lastDot = base.lastIndexOf('.');
  let name = base;
  if (lastDot > 0) {
    const ext = base.slice(lastDot).toLowerCase();
    name = base.slice(0, lastDot) + ext;
  }
  const sanitized = name.replace(/[^a-z0-9._-]/gi, '_');
  return sanitized.slice(0, 200);
}
