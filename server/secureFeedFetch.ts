import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_BYTES = 1024 * 1024;
const TIMEOUT_MS = 9000;

// Conservative IPv4 policy: reject non-global, special-use
// and reserved ranges. IPv6 is intentionally unsupported.
const BLOCKED: Array<[number, number]> = [
  [0, 8], [10, 8], [127, 8],
  [169, 16],
  [224, 4], [240, 4]
];

// Additional exact and narrow reserved IPv4 ranges.
const SPECIAL: Array<[string, number]> = [
  ['100.64.0.0', 10],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24]
];

function asInt(ip: string): number {
  return ip.split('.').reduce(
    (n, part) => ((n << 8) | Number(part)) >>> 0, 0
  );
}

function inCidr(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (asInt(ip) & mask) === (asInt(base) & mask);
}

export function isPublicIPv4(ip: string): boolean {
  if (isIP(ip) !== 4) return false;

  const first = Number(ip.split('.')[0]);
  const second = Number(ip.split('.')[1]);

  if (BLOCKED.some(([a, bits]) =>
    inCidr(ip, `${a}.0.0.0`, bits))) return false;

  // 192.0.0.0/8 is treated conservatively.
  if (first === 192 && second === 0) return false;

  return !SPECIAL.some(([base, bits]) => inCidr(ip, base, bits));
}

export async function secureFeedFetch(input: string): Promise<string> {
  const url = new URL(input);

  if (url.protocol !== 'https:' ||
      url.username || url.password ||
      url.port && url.port !== '443' ||
      url.hostname.endsWith('.') ||
      isIP(url.hostname) !== 0) {
    throw new Error('UNSAFE_FEED_URL');
  }

  const hostname = url.hostname.toLowerCase();

  if (hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')) {
    throw new Error('UNSAFE_FEED_URL');
  }

  // Resolve once. Reject if ANY returned address is unsafe.
  // One deadline covers DNS resolution and HTTPS.
  const deadline = AbortSignal.timeout(TIMEOUT_MS);

  const addresses = await Promise.race([
    lookup(hostname, { all: true, verbatim: true }),
    new Promise<never>((_, reject) => {
      deadline.addEventListener('abort', () => {
        reject(new Error('FEED_DNS_TIMEOUT'));
      }, { once: true });
    })
  ]);

  if (!addresses.length ||
      addresses.some(a => !isPublicIPv4(a.address))) {
    throw new Error('UNSAFE_FEED_DNS');
  }

  const selected = addresses[0].address;

  return await new Promise<string>((resolve, reject) => {
    let settled = false;
    const fail = (error: Error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    const req = https.request(url, {
      method: 'GET',
      agent: false,
      signal: deadline,
      timeout: TIMEOUT_MS,
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/xml',
        'Accept-Encoding': 'identity',
        'User-Agent': 'GPU-OS-ReadOnly-Discovery/1.0'
      },
      lookup: (_host, _options, callback) => {
        callback(null, selected, 4);
      },
      rejectUnauthorized: true,
      servername: hostname
    }, response => {
      if (!response.statusCode ||
          response.statusCode < 200 ||
          response.statusCode >= 300) {
        response.destroy();
        fail(new Error('FEED_HTTP_' + response.statusCode));
        return;
      }

      const chunks: Buffer[] = [];
      let bytes = 0;

      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_BYTES) {
          response.destroy();
          fail(new Error('FEED_TOO_LARGE'));
          return;
        }
        chunks.push(chunk);
      });

      response.on('end', () => {
        if (!settled) {
          settled = true;
          resolve(Buffer.concat(chunks).toString('utf8'));
        }
      });

      response.on('error', fail);
    });

    req.on('timeout', () => {
      req.destroy(new Error('FEED_TIMEOUT'));
    });
    req.on('error', fail);
    req.end();
  });
}
