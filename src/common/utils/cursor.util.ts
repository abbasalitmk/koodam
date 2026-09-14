import { AppException } from './app.exception';
import { ErrorCode } from './error-codes';

export interface DecodedCursor {
  /** ISO timestamp of the last item on the previous page. */
  ts: string;
  /** Tie-breaker id, so rows sharing a timestamp are not skipped or repeated. */
  id: string;
  /** Optional numeric score for ranked feeds (dating / recommendations). */
  score?: number;
}

/**
 * Cursors are base64url-encoded JSON. They are opaque to clients but cheap to
 * build, and they keep keyset pagination stable when new rows arrive mid-scroll.
 */
export function encodeCursor(cursor: DecodedCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(raw?: string): DecodedCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as DecodedCursor;
    if (typeof parsed.ts !== 'string' || typeof parsed.id !== 'string') {
      throw new Error('malformed');
    }
    return parsed;
  } catch {
    throw AppException.badRequest(ErrorCode.VALIDATION_FAILED, 'Malformed pagination cursor');
  }
}
