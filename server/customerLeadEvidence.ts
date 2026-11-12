export interface CustomerLeadEvidenceInput {
  title: string;
  description: string;
  sourceUrl: string;
  publishedAt?: string | null;
  buyerIdentity?: string | null;
  requirementDetails?: string | null;
  customerConfirmationReference?: string | null;
}

export type CustomerLeadEvidenceStatus =
  | 'INSUFFICIENT_EVIDENCE'
  | 'CANDIDATE'
  | 'REVIEW_REQUIRED'
  | 'CUSTOMER_CONFIRMATION_RECORDED';

export interface CustomerLeadEvidenceResult {
  status: CustomerLeadEvidenceStatus;
  reasons: string[];
  verifiedCustomer: false;
  paymentVerified: false;
  realizedRevenueUsd: 0;
}

export function assessCustomerLeadEvidence(
  input: CustomerLeadEvidenceInput,
  now: Date = new Date()
): CustomerLeadEvidenceResult {
  const reasons: string[] = [];

  let validSource = false;
  try {
    const url = new URL(input.sourceUrl);
    validSource =
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      Boolean(url.hostname.includes('.'));
  } catch {
    // Invalid URLs remain unverified.
  }

  if (!validSource) reasons.push('INVALID_SOURCE_URL');

  const published = input.publishedAt
    ? new Date(input.publishedAt)
    : null;

  const validDate =
    published !== null &&
    Number.isFinite(published.getTime());

  if (!validDate) {
    reasons.push('MISSING_OR_INVALID_PUBLICATION_DATE');
  } else {
    const age = now.getTime() - published.getTime();
    if (age < 0 || age > 30 * 86400000) {
      reasons.push('STALE_OR_FUTURE_PUBLICATION');
    }
  }

  if (!input.buyerIdentity?.trim()) {
    reasons.push('BUYER_IDENTITY_NOT_ESTABLISHED');
  }

  if (!input.requirementDetails?.trim()) {
    reasons.push('REQUIREMENTS_NOT_ESTABLISHED');
  }

  if (!input.title?.trim() || !input.description?.trim()) {
    reasons.push('INSUFFICIENT_LEAD_CONTENT');
  }

  const confirmation =
    Boolean(input.customerConfirmationReference?.trim());

  if (!confirmation) {
    reasons.push('CUSTOMER_CONFIRMATION_MISSING');
  }

  let status: CustomerLeadEvidenceStatus =
    'INSUFFICIENT_EVIDENCE';

  if (validSource && input.title?.trim()) {
    status = 'CANDIDATE';
  }

  if (
    validSource &&
    validDate &&
    !reasons.includes('STALE_OR_FUTURE_PUBLICATION') &&
    input.buyerIdentity?.trim() &&
    input.requirementDetails?.trim() &&
    input.description?.trim()
  ) {
    status = confirmation
      ? 'CUSTOMER_CONFIRMATION_RECORDED'
      : 'REVIEW_REQUIRED';
  }

  return {
    status,
    reasons,
    verifiedCustomer: false,
    paymentVerified: false,
    realizedRevenueUsd: 0
  };
}
