import { configuredDiscoverySources } from './phase20/discoverySources.js';
import { qualifyPublishedLead } from './leadQualification.js';
import { parseFeedXml, feedEntries } from './boundedFeedXml.js';
import { assessFeedPublication } from './feedPublicationEvidence.js';
import { assessCustomerLeadEvidence } from './customerLeadEvidence.js';
import { isCommercialComputeLead } from './commercialLeadFilter.js';
import type { Express, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import crypto from 'crypto';
import { secureFeedFetch } from './secureFeedFetch.js';
import fs from 'node:fs';
import { isIP } from 'node:net';

// Evidence-backed discovery: candidate URLs are not customers, contracts or revenue.
// Explicitly configured public RSS/Atom feeds only; no scraping, spam or outbound email.
export interface AcquisitionLeadRecord {
  id: string;
  title: string;
  description?: string;
  published_at?: string | Date | null;
  source_url: string;
  source_feed: string;
  discovered_at: string;
  status: 'CANDIDATE' | 'REVIEWING' | 'QUALIFIED' | 'REJECTED';
}

export const inMemoryLeadsStore: AcquisitionLeadRecord[] = [];

const db = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: /^(localhost|dpg-[a-z0-9-]+)$/.test(new URL(process.env.DATABASE_URL).hostname)
        ? undefined
        : {
            rejectUnauthorized: true,
            ...(process.env.DATABASE_SSL_CA
              ? { ca: fs.readFileSync(process.env.DATABASE_SSL_CA, 'utf8') }
              : {})
          },
      connectionTimeoutMillis: 5000,
      query_timeout: 5000,
      max: 2
    })
  : null;

// Keep unexpected idle PostgreSQL connection failures
// from terminating the Node.js process.
db?.on('error', (err: Error) => {
  const code = (err as NodeJS.ErrnoException).code || 'UNKNOWN';
  console.error('[LEAD DISCOVERY POOL]', {
    name: err.name,
    code
  });
});

const MAX_FEEDS = 5,
  MAX_ENTRIES = 40;

const feeds = () => configuredDiscoverySources(process.env.LEAD_SOURCE_REGISTRY_JSON,process.env.LEAD_RSS_FEEDS || '').map(source=>source.feedUrl).slice(0,MAX_FEEDS);

function publicFeedReference(input: string): string {
  try { const url = new URL(input); return url.origin + url.pathname; }
  catch { return 'INVALID_FEED_URL'; }
}

export function safeFeed(u: string) {
  try {
    const x = new URL(u);
    return (
      x.protocol === 'https:' && !x.username && !x.password &&
      isIP(x.hostname) === 0 && !x.hostname.endsWith('.localhost') &&
      (!x.port || x.port === '443') && !x.hostname.endsWith('.') &&
      !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|::1|\[)/i.test(x.hostname) &&
      !x.hostname.endsWith('.local') &&
      !x.hostname.endsWith('.internal')
    );
  } catch {
    return false;
  }
}

let initialized: Promise<void> | undefined;

async function ready() {
  if (db) {
    if (!initialized) {
      // Read-only compatibility probe. Schema changes require a reviewed offline migration.
      initialized = db.query(
        'SELECT id,title,source_url,source_feed,description,published_at,discovered_at,status FROM acquisition_leads LIMIT 0'
      ).then(() => undefined)
        .catch((e) => {
          initialized = undefined;
          throw e;
        });
    }
    await initialized;
    return;
  }

  // Only explicit test harness allows in-memory test fallback
  if (process.env.NODE_ENV === 'test' && process.env.DISABLE_JSON_PERSISTENCE === 'true') {
    return;
  }

  throw Error('DATABASE_URL_NOT_CONFIGURED');
}

export async function persistAcquisitionLead(
  store: Pick<Pool, 'query'> | null,
  lead: AcquisitionLeadRecord
): Promise<boolean> {
  if (store) {
    const result = await store.query(
      `INSERT INTO acquisition_leads (id,title,source_url,source_feed,description,published_at)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id`,
      [lead.id, lead.title, lead.source_url, lead.source_feed, lead.description ?? null, lead.published_at ?? null]
    );
    return result.rows.length === 1;
  }
  if (!(process.env.NODE_ENV === 'test' && process.env.DISABLE_JSON_PERSISTENCE === 'true')) throw Error('TEST_STORE_FORBIDDEN');
  if (inMemoryLeadsStore.some(l => l.id === lead.id || l.source_url === lead.source_url)) return false;
  inMemoryLeadsStore.unshift(lead);
  return true;
}

async function scan(
  fetchFeed: (url: string) => Promise<string> = secureFeedFetch
) {
  await ready();
  const results = [] as Array<{ feed: string; inserted: number; rejected?: Record<string, number>; error?: string }>;
  const feedList = feeds();

  if (feedList.length === 0) {
    return {
      mode: 'DISCOVERY_ONLY',
      outreachEnabled: false,
      purchasingEnabled: false,
      message: 'No feeds configured. Set LEAD_RSS_FEEDS to enable discovery.',
      results: []
    };
  }

  for (const feed of feedList) {
    if (!safeFeed(feed)) {
      results.push({ feed: publicFeedReference(feed), inserted: 0, error: 'UNSAFE_FEED_URL' });
      continue;
    }
    let inserted = 0;
    const rejected: Record<string, number> = {};
    const reject = (reason: string) => { rejected[reason] = (rejected[reason] || 0) + 1; };
    try {
      const xml = await fetchFeed(feed);
      const document = parseFeedXml(xml);
      if (document.children.length !== 1 || document.text.trim()) throw Error('INVALID_FEED_XML');
      const entries = feedEntries(document).slice(0, MAX_ENTRIES);
      for (const entry of entries) {
        // Phase 19: ingestion time is not publication evidence.
        // Only recently published entries enter candidate discovery.
        const publication = assessFeedPublication(entry);

        if (!publication.eligibleForFreshReview) {
          reject(publication.decision);
          continue;
        }
        const text = (name: string) => entry.children.find(n => n.name === name)?.text || '';
        const plain = (value: string, max: number) => value.replace(/<[^<>]*>/g, '').trim().slice(0,max);
        const title = plain(text('title'), 240);
        const description = plain(text('description') || text('summary'), 600);
        if (!qualifyPublishedLead({title,description,source_url:'',source_feed:feed,published_at:publication.publishedAt}).freshForReview) {reject('PROCUREMENT_DEADLINE_PASSED');continue;}
        if (!title || !isCommercialComputeLead(title, description, feed)) { reject('NO_CLEAR_BUYER_INTENT'); continue; }
        let url = text('link').trim();
        if (!url) url = entry.children.find(n => n.name === 'link' && (!n.attributes.rel || n.attributes.rel === 'alternate'))?.attributes.href || '';
        if (!safeFeed(url)) { reject('UNSAFE_SOURCE_URL'); continue; }
        const canonical = new URL(url);
        canonical.hash = '';
        url = canonical.href;
        const id = crypto.createHash('sha256').update(url).digest('hex');

        const accepted = await persistAcquisitionLead(db, {
          id, title, description, published_at: publication.publishedAt,
          source_url: url, source_feed: feed,
          discovered_at: new Date().toISOString(), status: 'CANDIDATE'
        });
        if (accepted) inserted += 1; else reject('DUPLICATE');
      }
      results.push({ feed, inserted, rejected });
    } catch (e: any) {
      results.push({ feed: publicFeedReference(feed), inserted, error: 'FEED_SCAN_FAILED' });
    }
  }
  return { mode: 'DISCOVERY_ONLY', outreachEnabled: false, purchasingEnabled: false, results };
}

function withEvidenceAssessment(
  leads: AcquisitionLeadRecord[]
) {
  return leads.map(lead => ({
    ...lead,
    qualification: qualifyPublishedLead(lead),
    evidenceAssessment: assessCustomerLeadEvidence({
      title: lead.title,
      description: ('description' in lead &&
        typeof lead.description === 'string')
        ? lead.description
        : '',
      sourceUrl: lead.source_url,
      publishedAt: lead.published_at instanceof Date ? lead.published_at.toISOString() : lead.published_at ?? null,
      buyerIdentity: null,
      requirementDetails: null,
      customerConfirmationReference: null
    })
  }));
}

function leadResponse(leads: AcquisitionLeadRecord[]) {
  return {
    leads: withEvidenceAssessment(leads), verifiedCustomers: 0, realizedRevenueUsd: 0,
    commercialReadiness: {
      status: 'NOT_COMMERCIALLY_OPERATIONAL',
      publicSourcesIndependentlyVerified: false,
      supplierCapacity: 'NOT_VERIFIED',
      contracts: 'NOT_VERIFIED', payments: 'NOT_VERIFIED',
      mode: 'DISCOVERY_ONLY', outreachEnabled: false, purchasingEnabled: false
    }
  };
}

export function registerLeadDiscovery(
  app: Express,
  owner: (req: Request, res: Response, next: NextFunction) => void,
  fetchFeed: (url: string) => Promise<string> = secureFeedFetch
) {
  if (fetchFeed !== secureFeedFetch && !(process.env.NODE_ENV === 'test' && process.env.DISABLE_JSON_PERSISTENCE === 'true' && !process.env.DATABASE_URL)) {
    throw Error('TEST_TRANSPORT_FORBIDDEN');
  }
  app.post('/api/acquisition/discover', owner, async (_req, res) => {
    try {
      res.json(await scan(fetchFeed));
    } catch (e: any) {
      res.status(503).json({ error: 'LEAD_STORE_UNAVAILABLE' });
    }
  });

  app.get('/api/acquisition/leads', owner, async (_req, res) => {
    try {
      if (process.env.NODE_ENV === 'test' &&
          process.env.LEAD_TEST_IN_MEMORY === 'true') {
        return res.json(leadResponse(inMemoryLeadsStore));
      }
      await ready();
      if (db) {
        const r = await db.query(
          'SELECT id,title,source_url,source_feed,description,published_at,discovered_at,status FROM acquisition_leads ORDER BY discovered_at DESC LIMIT 100'
        );
        return res.json(leadResponse(r.rows));
      }
      return res.json(leadResponse(inMemoryLeadsStore));
    } catch (e: any) {
      res.status(503).json({ error: 'LEAD_STORE_UNAVAILABLE' });
    }
  });

  app.patch('/api/acquisition/leads/:id', owner, async (req, res) => {
    const status = req.body?.status;
    if (!['REVIEWING', 'QUALIFIED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'INVALID_STATUS' });
    }
    try {
      if (process.env.NODE_ENV === 'test' &&
          process.env.LEAD_TEST_IN_MEMORY === 'true') {
        const match = inMemoryLeadsStore.find(
          (l) => l.id === req.params.id
        );
        if (!match) {
          return res.status(404).json({ error: 'NOT_FOUND' });
        }
        match.status = status;
        return res.status(200).json({
          id: match.id,
          status: match.status
        });
      }
      await ready();
      if (db) {
        const r = await db.query('UPDATE acquisition_leads SET status=$1 WHERE id=$2 RETURNING id,status', [
          status,
          req.params.id
        ]);
        return res.status(r.rowCount ? 200 : 404).json(r.rows[0] || { error: 'NOT_FOUND' });
      }
      const match = inMemoryLeadsStore.find((l) => l.id === req.params.id);
      if (!match) return res.status(404).json({ error: 'NOT_FOUND' });
      match.status = status;
      return res.status(200).json({ id: match.id, status: match.status });
    } catch (e: any) {
      res.status(503).json({ error: 'LEAD_STORE_UNAVAILABLE' });
    }
  });
}
