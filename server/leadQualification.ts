import { createHash } from 'node:crypto';
import { strictPublicationTimestamp } from './publicationTimestamp.js';

// Advisory extraction from published content, never a verified buyer or hardware sizing estimate.
export function qualifyPublishedLead(lead: {
  title: string; description?: string; source_url: string; source_feed: string;
  published_at?: string | Date | null;
}, now = new Date()) {
  const content = `${lead.title} ${lead.description || ''}`.slice(0, 840);
  const timestamp = lead.published_at instanceof Date ? lead.published_at.getTime()
    : lead.published_at ? strictPublicationTimestamp(lead.published_at) : NaN;
  let expires = Number.isFinite(timestamp) ? timestamp + 30 * 86400000 : null;
  const models = [...new Set(content.match(/\b(?:H100|H200|A100|B200|RTX\s*4090)\b/gi) || [])];
  const contacts = [...new Set(content.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b/gi) || [])].slice(0,5);
  const workloadKinds = [
    ['TRANSCRIPTION', /transcri|speech.to.text/i],
    ['RENDERING', /render|video/i],
    ['INFERENCE', /inference/i],
    ['TRAINING', /training|fine.tun/i],
    ['BATCH_PROCESSING', /batch|image processing/i]
  ] as const;
  const deadlineMatches=[...content.matchAll(/(?:deadline|closing date|submit by)\s*:?\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2}))/gi)];
  const deadlines=deadlineMatches.map(m=>strictPublicationTimestamp(m[1])).filter(Number.isFinite);
  if (expires!==null && deadlines.length) expires=Math.min(expires,...deadlines);
  const statedCount=content.match(/\b(\d{1,3})\s+GPUs?\b/i);
  const statedVram=content.match(/\b(\d{1,3})\s*(?:GB|GiB)\s+(?:VRAM|GPU memory)\b/i);
  const buyerStatement=content.match(/\b(?:buyer|organization|company):\s*([^;\n.]{2,100})/i)?.[1]?.trim() ?? null;
  const fresh = expires !== null && timestamp <= now.getTime() && expires >= now.getTime();
  return {
    normalizedEvidenceSha256: createHash('sha256').update(JSON.stringify([lead.title,lead.description ?? '',lead.source_url,lead.source_feed,Number.isFinite(timestamp)?timestamp:null])).digest('hex'),
    procurementDeadlines: deadlines.map(ms=>new Date(ms).toISOString()),
    deadlineEvidenceVerified: false,
    deadlineReviewRequired: /deadline|closing date|submit by/i.test(content) && !deadlines.length,
    buyerIdentityStatement: buyerStatement,
    buyerIdentityVerified: false,
    contractRequiredByPublisher: /signed contract|contract required|contractor agreement|nda required/i.test(content),
    reviewQueue: expires!==null && expires<now.getTime() ? 'EXPIRED_RETAIN_EVIDENCE' : 'HUMAN_REVIEW_REQUIRED',
    provenance: { sourceUrl: lead.source_url, sourceFeed: lead.source_feed, publicationBasis: 'PUBLISHER_CLAIM_UNVERIFIED' },
    humanReviewRequired: true,
    expiresAt: expires === null ? null : new Date(expires).toISOString(),
    expiryBasis: deadlines.length ? 'PUBLISHER_DEADLINE_AND_30_DAY_REVIEW_POLICY' : '30_DAY_REVIEW_POLICY',
    freshForReview: fresh,
    relevanceScore: fresh ? Math.min(100, 40 + models.length * 10 + (contacts.length ? 10 : 0)) : 0,
    scoreBasis: 'TRIAGE_ONLY_NOT_CONVERSION_PROBABILITY',
    workloadKinds: workloadKinds.filter(([,pattern]) => pattern.test(content)).map(([kind]) => kind),
    statedGpuModels: models,
    gpuCount: statedCount && Number(statedCount[1])>0 && Number(statedCount[1])<=128 ? Number(statedCount[1]) : null,
    requiredVramGb: statedVram && Number(statedVram[1])>0 && Number(statedVram[1])<=512 ? Number(statedVram[1]) : null,
    hardwareRequirementsVerified: false,
    durationHours: null,
    sizingStatus: 'HUMAN_REQUIREMENTS_REVIEW_REQUIRED',
    publishedContactAddresses: contacts,
    contactVerified: false,
    outreachEnabled: false
  };
}
