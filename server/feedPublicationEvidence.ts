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

function extractDateFields(entry: string): string[] {
  const values: string[] = [];

  for (const name of ['pubDate', 'published']) {
    const regex = new RegExp(
      '<' + name +
      '(?:\\s[^>]*)?>([\\s\\S]*?)</' +
      name + '>',
      'gi'
    );

    for (const match of entry.matchAll(regex)) {
      values.push(match[1].trim());
    }
  }

  return values;
}

export function assessFeedPublication(
  entry: string,
  now: Date = new Date()
): PublicationEvidence {
  const dates = extractDateFields(entry);

  if (dates.length === 0) {
    return {
      publishedAt: null,
      decision: /<updated(?:\\s[^>]*)?>/i.test(entry)
        ? 'UPDATED_ONLY'
        : 'MISSING_DATE',
      eligibleForFreshReview: false
    };
  }

  const timestamps = dates.map(value => new Date(value).getTime());

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

  if (!Number.isFinite(now.getTime())) {
    throw new Error('INVALID_REFERENCE_DATE');
  }

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
