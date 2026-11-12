export function classifyPostgresError(error: unknown): string {
  const code =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : '';

  const categories: Record<string, string> = {
    '28P01': 'AUTHENTICATION',
    '28000': 'AUTHORIZATION',
    '3D000': 'DATABASE_NOT_FOUND',
    '42P01': 'MISSING_TABLE',
    'ECONNREFUSED': 'NETWORK_REFUSED',
    'ENOTFOUND': 'DNS_RESOLUTION',
    'EAI_AGAIN': 'DNS_TEMPORARY',
    'ETIMEDOUT': 'NETWORK_TIMEOUT',
    'ECONNRESET': 'NETWORK_RESET',
    'CERT_HAS_EXPIRED': 'TLS_CERTIFICATE',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE': 'TLS_CERTIFICATE',
    'SELF_SIGNED_CERT_IN_CHAIN': 'TLS_CERTIFICATE',
    'DEPTH_ZERO_SELF_SIGNED_CERT': 'TLS_CERTIFICATE',
    'ERR_TLS_CERT_ALTNAME_INVALID': 'TLS_HOSTNAME'
  };

  return categories[code] ?? 'UNCLASSIFIED';
}
