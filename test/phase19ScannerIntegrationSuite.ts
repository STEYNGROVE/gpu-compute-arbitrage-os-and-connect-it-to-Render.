import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import {
  registerLeadDiscovery,
  inMemoryLeadsStore
} from '../server/leadDiscovery.js';

if (
  process.env.NODE_ENV !== 'test' ||
  process.env.DISABLE_JSON_PERSISTENCE !== 'true' ||
  process.env.DATABASE_URL
) {
  throw new Error('TEST_ENVIRONMENT_REQUIRED');
}

process.env.LEAD_TEST_IN_MEMORY = 'true';
process.env.LEAD_RSS_FEEDS =
  'https://example.org/phase19-test.xml';

const now = new Date();

function date(daysAgo: number): string {
  return new Date(
    now.getTime() - daysAgo * 86400000
  ).toUTCString();
}

const buyerTitle =
  'Seeking a GPU provider for production inference workload';

function item(
  id: number,
  title: string,
  published?: string
): string {
  return `<item>
    <title>${title}</title>
    <description>Need GPU capacity for production inference.</description>
    <link>https://example.org/jobs/${id}</link>
    ${published ? `<pubDate>${published}</pubDate>` : ''}
  </item>`;
}

const feedXml = `<rss><channel>
  ${item(101, buyerTitle, date(1))}
  ${item(102, buyerTitle, date(90))}
  ${item(103, buyerTitle)}
  ${item(104, buyerTitle, date(-2))}
  ${item(105, 'GPU rental service available', date(1))}
  ${item(101, buyerTitle, date(1))}
</channel></rss>`;

let fetchCount = 0;

const mockFetch = async (url: string): Promise<string> => {
  assert.equal(
    url,
    'https://example.org/phase19-test.xml'
  );
  fetchCount++;
  return feedXml;
};

const app = express();
app.use(express.json());

const owner = (req: any, res: any, next: any) => {
  if (req.headers.authorization === 'Bearer test-owner') {
    return next();
  }
  return res.status(401).json({ error: 'UNAUTHORIZED' });
};

registerLeadDiscovery(app, owner, mockFetch);

const server = http.createServer(app);

async function main() {
  inMemoryLeadsStore.length = 0;

  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  assert(address && typeof address !== 'string');

  const base = `http://127.0.0.1:${address.port}`;

  try {
    const unauthorized = await fetch(
      `${base}/api/acquisition/discover`,
      { method: 'POST' }
    );

    assert.equal(unauthorized.status, 401);
    assert.equal(fetchCount, 0);

    const first = await fetch(
      `${base}/api/acquisition/discover`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-owner'
        }
      }
    );

    assert.equal(first.status, 200);

    const firstBody = await first.json() as any;

    assert.equal(firstBody.mode, 'DISCOVERY_ONLY');
    assert.equal(firstBody.outreachEnabled, false);
    assert.equal(firstBody.purchasingEnabled, false);
    assert.equal(firstBody.results[0].inserted, 1);
    assert.equal(inMemoryLeadsStore.length, 1);

    const second = await fetch(
      `${base}/api/acquisition/discover`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-owner'
        }
      }
    );

    assert.equal(second.status, 200);

    const secondBody = await second.json() as any;

    assert.equal(secondBody.results[0].inserted, 0);
    assert.equal(inMemoryLeadsStore.length, 1);
    assert.equal(fetchCount, 2);

    const leads = await fetch(
      `${base}/api/acquisition/leads`,
      {
        headers: {
          Authorization: 'Bearer test-owner'
        }
      }
    );

    assert.equal(leads.status, 200);

    const leadsBody = await leads.json() as any;

    assert.equal(leadsBody.verifiedCustomers, 0);
    assert.equal(leadsBody.realizedRevenueUsd, 0);
    assert.equal(leadsBody.leads.length, 1);
    assert.equal(
      leadsBody.leads[0].evidenceAssessment.verifiedCustomer,
      false
    );

    console.log(
      'PASS: scanner HTTP authentication, freshness, ' +
      'supplier filtering, deduplication and financial safety'
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(err => err ? reject(err) : resolve());
    });
    inMemoryLeadsStore.length = 0;
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
