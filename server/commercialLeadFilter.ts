// Conservative public lead triage. A candidate is not a verified customer.
const technical = /\b(gpu|cuda|machine learning|deep learning|model training|render farm|h100|h200|a100|b200|compute cluster|inference)\b/i;
const procurement = /\b(rfp|rfq|tender|procurement)\b|request for (proposal|quotation)/i;
const buying = /\b(looking to (rent|buy|purchase|hire)|seeking (a )?(gpu|compute) provider|need gpu capacity|need (gpu|ai) compute|requesting (gpu|compute) quotes?|gpu provider wanted|buy compute|rent gpu|paid (gpu|compute) contract)\b/i;
const hiring = /who is hiring|whoishiring|we are hiring|job opening|recruiting|vacancy|full.time position|careers? page|apply for (this )?(job|role)/i;
export function isCommercialComputeLead(title: string, description: string, feed: string): boolean {
  const body = `${title} ${description}`;
  // Entire employment-oriented feeds are unsuitable, even if a post mentions RFQs.
  if (hiring.test(feed) || hiring.test(body)) return false;
  return technical.test(body) && (procurement.test(body) || buying.test(body));
}
