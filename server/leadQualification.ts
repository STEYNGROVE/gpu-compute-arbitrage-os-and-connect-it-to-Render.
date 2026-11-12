import { strictPublicationTimestamp } from './publicationTimestamp.js';

// Advisory extraction from published content, never a verified buyer or hardware sizing estimate.
export function qualifyPublishedLead(lead: {
  title: string; description?: string; source_url: string; source_feed: string;
  published_at?: string | Date | null;
}, now = new Date()) {
  const content = `${lead.title} ${lead.description || ''}`.slice(0, 840);
  const timestamp = lead.published_at instanceof Date ? lead.published_at.getTime()
    : lead.published_at ? strictPublicationTimestamp(lead.published_at) : NaN;
  const expires = Number.isFinite(timestamp) ? timestamp + 30 * 86400000 : null;
  const models = [...new Set(content.match(/\b(?:H100|H200|A100|B200|RTX\s*4090)\b/gi) || [])];
  const contacts = [...new Set(content.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/gi) || [])].slice(0,5);
  const workloadKinds = [
    ['TRANSCRIPTION', /transcri|speech.to.text/i],
    ['RENDERING', /render|video/i],
    ['INFERENCE', /inference/i],
    ['TRAINING', /training|fine.tun/i],
    ['BATCH_PROCESSING', /batch|image processing/i]
  ] as const;
  const fresh = expires !== null && timestamp <= now.getTime() && expires >= now.getTime();
  return {
    provenance: { sourceUrl: lead.source_url, sourceFeed: lead.source_feed, publicationBasis: 'PUBLISHER_CLAIM_UNVERIFIED' },
    humanReviewRequired: true,
    expiresAt: expires === null ? null : new Date(expires).toISOString(),
    expiryBasis: '30_DAY_REVIEW_POLICY',
    freshForReview: fresh,
    relevanceScore: fresh ? Math.min(100, 40 + models.length * 10 + (contacts.length ? 10 : 0)) : 0,
    scoreBasis: 'TRIAGE_ONLY_NOT_CONVERSION_PROBABILITY',
    workloadKinds: workloadKinds.filter(([,pattern]) => pattern.test(content)).map(([kind]) => kind),
    statedGpuModels: models,
    gpuCount: null, requiredVramGb: null, durationHours: null,
    sizingStatus: 'HUMAN_REQUIREMENTS_REVIEW_REQUIRED',
    publishedContactAddresses: contacts,
    contactVerified: false,
    outreachEnabled: false
  };
}
