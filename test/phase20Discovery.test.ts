import {test} from 'node:test';
import assert from 'node:assert/strict';
import {configuredDiscoverySources} from '../server/phase20/discoverySources.js';
import {qualifyPublishedLead} from '../server/leadQualification.js';
import {now} from './phase20Fixtures.js';
const source={feedUrl:'https://example.org/public-feed',termsReference:'https://example.org/terms',reviewerReference:'reviewer_test01',reviewedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+60000).toISOString()};
test('source registry records administrative terms review without claiming independent verification',()=>{
  assert.equal(configuredDiscoverySources(JSON.stringify([source]),'',now)[0].configurationStatus,'REVIEWED_CONFIGURATION_ONLY');
  assert.equal(configuredDiscoverySources(undefined,'https://example.org/legacy',now)[0].configurationStatus,'LEGACY_UNVERIFIED');
  assert.deepEqual(configuredDiscoverySources('[]','https://example.org/legacy',now),[]);
});
test('invalid source registry cannot silently fall back to unreviewed sources',()=>{
  for(const record of [{...source,feedUrl:'http://localhost'},{...source,feedUrl:'https://user:password@example.org/feed'},{...source,termsReference:'https://example.org/terms?token=secret'},{...source,expiresAt:new Date(now-1).toISOString()},{...source,approved:true}]) assert.throws(()=>configuredDiscoverySources(JSON.stringify([record]),'https://example.org/legacy',now));
  assert.throws(()=>configuredDiscoverySources(JSON.stringify([source,source]),'',now));
  assert.throws(()=>configuredDiscoverySources('x'.repeat(17000),'',now));
});
test('published procurement deadline expires review without inventing buyer or capacity proof',()=>{
  const result=qualifyPublishedLead({title:'RFQ H100 inference',description:'Company: Example buyer; Need 2 GPUs with 80 GB VRAM. Signed contract required. Deadline: 2026-11-11T12:00:00Z',source_url:'https://example.org/rfq',source_feed:source.feedUrl,published_at:'2026-11-10T12:00:00Z'},new Date(now));
  assert.equal(result.freshForReview,false);assert.equal(result.reviewQueue,'EXPIRED_RETAIN_EVIDENCE');assert.equal(result.gpuCount,2);assert.equal(result.requiredVramGb,80);
  assert.equal(result.contractRequiredByPublisher,true);assert.equal(result.buyerIdentityVerified,false);assert.equal(result.deadlineEvidenceVerified,false);
  assert.match(result.normalizedEvidenceSha256,/^[a-f0-9]{64}$/);assert.equal(result.buyerIdentityStatement,'Example buyer');
});
test('date-only or impossible deadlines require human review',()=>{
  for(const deadline of ['2026-11-13','2026-02-30T12:00:00Z']) {
    const result=qualifyPublishedLead({title:'RFQ GPU inference',description:'Deadline: '+deadline,source_url:'https://example.org/rfq',source_feed:source.feedUrl,published_at:'2026-11-10T12:00:00Z'},new Date(now));
    assert.equal(result.deadlineReviewRequired,true);assert.deepEqual(result.procurementDeadlines,[]);
  }
});
