// Conservative public lead triage. A candidate is not a verified customer.
const technical = /\b(gpu|cuda|machine learning|deep learning|model training|render farm|h100|h200|a100|b200|compute cluster|inference)\b/i;
const procurement = /\b(rfp|rfq|tender|procurement)\b|request for (proposal|quotation)/i;
const buying = /\b(looking to (rent|buy|purchase|hire)|seeking (a )?(gpu|compute) provider|need gpu capacity|need (gpu|ai) compute|requesting (gpu|compute) quotes?|gpu provider wanted|buy compute|rent gpu|paid (gpu|compute) contract)\b/i;
const hiring = /who is hiring|whoishiring|we are hiring|job opening|recruiting|vacancy|full.time position|careers? page|apply for (this )?(job|role)/i;

// Phase 19: finished-job demand, not proof of a customer.
const finishedJob = /\b(transcri(?:be|ption)|speech.to.text|batch (?:processing|inference)|image (?:processing|generation)|video (?:processing|rendering)|llm inference|model (?:fine.tuning|fine.tune|deployment)|fine.tun(?:e|ing)|ai inference)\b/i;

const serviceBuying = /\b(need|seeking|looking for|request(?:ing)?|rfq|rfp|tender|procurement|contractor wanted|provider wanted|outsource|paid project|hire a (?:provider|contractor|service))\b/i;

const supplyAdvertising = /\b(we offer|we provide|available for rent|rent our|our gpu servers|gpu hosting available|gpu rental service|selling gpu capacity)\b/i;

export function isCommercialComputeLead(title: string, description: string, feed: string): boolean {
  const body = `${title} ${description}`;
  // Entire employment-oriented feeds are unsuitable, even if a post mentions RFQs.
  if (hiring.test(feed) || hiring.test(body)) return false;
  if (supplyAdvertising.test(body)) return false;

  const infrastructureDemand =
    technical.test(body) &&
    (procurement.test(body) || buying.test(body));

  const completedWorkDemand =
    finishedJob.test(body) &&
    serviceBuying.test(body);

  return infrastructureDemand || completedWorkDemand;
}
