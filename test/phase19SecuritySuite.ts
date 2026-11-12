import assert from 'node:assert/strict';
import express from 'express';
import { boundedSupplierJson } from '../server/boundedSupplierJson.js';
import { feedEntries, parseFeedXml } from '../server/boundedFeedXml.js';
import { qualifyPublishedLead } from '../server/leadQualification.js';
import { registerLeadDiscovery, safeFeed } from '../server/leadDiscovery.js';

assert.deepEqual(await boundedSupplierJson(new Response('{"ok":true}')), {ok:true});
await assert.rejects(boundedSupplierJson(new Response('x'.repeat(100)), 50), /TOO_LARGE/);
await assert.rejects(boundedSupplierJson(new Response('{')), SyntaxError);
let canceled = false;
const stream = new ReadableStream<Uint8Array>({
  start(controller) { controller.enqueue(new Uint8Array(20)); },
  cancel() { canceled = true; }
});
await assert.rejects(boundedSupplierJson(new Response(stream), 10), /TOO_LARGE/);
assert(canceled);
assert.equal(feedEntries(parseFeedXml('<rss><channel><description><![CDATA[<item><title>fake</title></item>]]></description></channel></rss>')).length, 0);
assert.equal(feedEntries(parseFeedXml('<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>real</title></entry></feed>')).length, 1);
for (const url of ['https://name:password@example.org/feed', 'https://example.org:8443/feed', 'https://example.org./feed']) assert.equal(safeFeed(url), false);
const nodeEnv = process.env.NODE_ENV;
try {
  process.env.NODE_ENV = 'production';
  assert.throws(() => registerLeadDiscovery(express(), (_req,_res,next) => next(), async () => ''), /TEST_TRANSPORT_FORBIDDEN/);
} finally { process.env.NODE_ENV = nodeEnv; }
const qualification = qualifyPublishedLead({
  title:'RFQ H100 inference', description:'Published contact buyer@example.org',
  source_url:'https://example.org/rfq/1', source_feed:'https://example.org/feed', published_at:'2026-11-10T12:00:00Z'
}, new Date('2026-11-12T12:00:00Z'));
assert.equal(qualification.expiresAt, '2026-12-10T12:00:00.000Z');
assert.deepEqual(qualification.publishedContactAddresses, ['buyer@example.org']);
assert.equal(qualification.gpuCount, null);
assert.equal(qualification.contactVerified, false);
assert.equal(qualification.outreachEnabled, false);
assert.equal(qualification.provenance.sourceUrl, 'https://example.org/rfq/1');
console.log('PASS: bounded supplier payload/cancellation, XML structure, transport injection, source URLs, advisory qualification');
