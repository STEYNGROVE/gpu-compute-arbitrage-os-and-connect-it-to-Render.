import { parseFeedXml, type FeedXmlNode } from './boundedFeedXml.js';
import { strictPublicationTimestamp } from './publicationTimestamp.js';
export type PublicationDecision =
  | 'RECENT'
  | 'MISSING_DATE'
  | 'INVALID_DATE'
  | 'STALE'
  | 'FUTURE_DATE'
  | 'UPDATED_ONLY'
  | 'CONFLICTING_DATES';

export interface PublicationEvidence {
  publishedAt: string | null;
  decision: PublicationDecision;
  eligibleForFreshReview: boolean;
}

const DAY_MS = 86400000;
const MAX_AGE_DAYS = 30;

export function assessFeedPublication(
  entry: string | FeedXmlNode,
  now: Date = new Date()
): PublicationEvidence {
  if (!Number.isFinite(now.getTime())) throw new Error('INVALID_REFERENCE_DATE');
  let fields: FeedXmlNode[];
  try {
    const root = typeof entry === 'string' ? parseFeedXml(entry) : entry;
    const wrapped = typeof entry === 'string' && root.children.length === 1 && ['item', 'entry'].includes(root.children[0].name) ? root.children[0] : root;
    fields = wrapped.children;
  } catch {
    return { publishedAt: null, decision: 'INVALID_DATE', eligibleForFreshReview: false };
  }
  const dates = fields.filter(n => n.name === 'pubDate' || n.name === 'published');

  if (dates.length === 0) {
    return {
      publishedAt: null,
      decision: fields.some(n => n.name === 'updated')
        ? 'UPDATED_ONLY'
        : 'MISSING_DATE',
      eligibleForFreshReview: false
    };
  }

  const timestamps = dates.map(node => node.children.length ? NaN : strictPublicationTimestamp(node.text, node.name === 'published'));

  if (
    timestamps.some(value => !Number.isFinite(value))
  ) {
    return {
      publishedAt: null,
      decision: 'INVALID_DATE',
      eligibleForFreshReview: false
    };
  }

  if (new Set(timestamps).size !== 1) {
    return {
      publishedAt: null,
      decision: 'CONFLICTING_DATES',
      eligibleForFreshReview: false
    };
  }

  const parsed = new Date(timestamps[0]);

  const age = now.getTime() - parsed.getTime();

  if (age < 0) {
    return {
      publishedAt: parsed.toISOString(),
      decision: 'FUTURE_DATE',
      eligibleForFreshReview: false
    };
  }

  if (age > MAX_AGE_DAYS * DAY_MS) {
    return {
      publishedAt: parsed.toISOString(),
      decision: 'STALE',
      eligibleForFreshReview: false
    };
  }

  return {
    publishedAt: parsed.toISOString(),
    decision: 'RECENT',
    eligibleForFreshReview: true
  };
}
