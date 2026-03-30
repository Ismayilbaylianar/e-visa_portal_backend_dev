import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a unique request ID
 * Format: req_<uuid>
 */
export function generateRequestId(): string {
  return `req_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
}
