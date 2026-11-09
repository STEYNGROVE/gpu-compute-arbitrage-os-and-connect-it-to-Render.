export type EvidenceStatus =
  | 'CATALOG_ONLY'
  | 'CAPACITY_VERIFIED'
  | 'STALE'
  | 'UNAVAILABLE';

export interface GpuOfferEvidence {
  provider: 'vast_ai' | 'runpod';
  offerId: string;
  model: string;
  gpuCount: number;
  pricePerGpuHourUsd: number;
  checkedAt: string;
  capacityVerified: boolean;
  available: boolean | null;
  source: string;
}

export interface EvidenceAssessment {
  status: EvidenceStatus;
  eligibleForManualReview: boolean;
  purchasingAllowed: false;
  paymentVerified: false;
  reason: string;
}

export function assessGpuOffer(
  evidence: GpuOfferEvidence,
  now = Date.now(),
  maxAgeMinutes = 15
): EvidenceAssessment {
  const safe = (
    status: EvidenceStatus,
    reason: string
  ): EvidenceAssessment => ({
    status,
    reason,
    eligibleForManualReview:
      status === 'CAPACITY_VERIFIED',
    purchasingAllowed: false,
    paymentVerified: false
  });

  const age = now - Date.parse(evidence.checkedAt);

  if (
    !evidence.offerId?.trim() ||
    !evidence.model?.trim() ||
    !evidence.source?.trim() ||
    !Number.isInteger(evidence.gpuCount) ||
    evidence.gpuCount < 1 ||
    !Number.isFinite(evidence.pricePerGpuHourUsd) ||
    evidence.pricePerGpuHourUsd <= 0 ||
    !Number.isFinite(maxAgeMinutes) ||
    maxAgeMinutes <= 0 ||
    !Number.isFinite(age) ||
    age < 0 ||
    age > maxAgeMinutes * 60000
  ) {
    return safe('STALE', 'Invalid or expired evidence');
  }

  if (evidence.available === false) {
    return safe('UNAVAILABLE', 'Capacity unavailable');
  }

  if (
    evidence.capacityVerified &&
    evidence.available === true
  ) {
    return safe(
      'CAPACITY_VERIFIED',
      'Capacity evidence requires manual review'
    );
  }

  return safe(
    'CATALOG_ONLY',
    'Advertised price does not prove availability'
  );
}
