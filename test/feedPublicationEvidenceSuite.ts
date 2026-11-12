import assert from 'node:assert/strict';
import {
  assessFeedPublication
} from '../server/feedPublicationEvidence.js';

const now = new Date('2026-11-12T12:00:00Z');

const cases = [
  {
    name: 'Recent RSS',
    xml: '<pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate>',
    expected: 'RECENT'
  },
  {
    name: 'Recent Atom',
    xml: '<published>2026-11-11T12:00:00Z</published>',
    expected: 'RECENT'
  },
  {
    name: 'Atom updated is not publication proof',
    xml: '<updated>2026-11-10T12:00:00Z</updated>',
    expected: 'UPDATED_ONLY'
  },
  {
    name: 'Stale publication',
    xml: '<pubDate>Sat, 01 Aug 2026 12:00:00 GMT</pubDate>',
    expected: 'STALE'
  },
  {
    name: 'Future publication',
    xml: '<published>2026-11-15T12:00:00Z</published>',
    expected: 'FUTURE_DATE'
  },
  {
    name: 'Conflicting dates',
    xml: '<pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate>' +
      '<published>2026-08-01T12:00:00Z</published>',
    expected: 'CONFLICTING_DATES'
  },
  {
    name: 'Exact 30-day boundary',
    xml: '<published>2026-10-13T12:00:00Z</published>',
    expected: 'RECENT'
  },
  {
    name: 'One millisecond too old',
    xml: '<published>2026-10-13T11:59:59.999Z</published>',
    expected: 'STALE'
  },
  {
    name: 'Duplicate matching dates',
    xml: '<pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate>' +
      '<published>2026-11-10T12:00:00Z</published>',
    expected: 'RECENT'
  },
  {
    name: 'Missing publication',
    xml: '<title>GPU compute request</title>',
    expected: 'MISSING_DATE'
  },
  {
    name: 'Invalid publication',
    xml: '<pubDate>not-a-date</pubDate>',
    expected: 'INVALID_DATE'
  }
];

for (const item of cases) {
  const result = assessFeedPublication(item.xml, now);

  assert.equal(
    result.decision,
    item.expected,
    item.name
  );

  assert.equal(
    result.eligibleForFreshReview,
    item.expected === 'RECENT',
    item.name
  );
}

console.log(
  `PASS: ${cases.length} publication evidence cases`
);
for (const [xml, expected] of [
  ['<description><![CDATA[<pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate>]]></description>', 'MISSING_DATE'],
  ['<description><pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate></description>', 'MISSING_DATE'],
  ['<!-- <published>2026-11-11T12:00:00Z</published> -->', 'MISSING_DATE'],
  ['<content>&lt;published&gt;2026-11-11T12:00:00Z&lt;/published&gt;</content>', 'MISSING_DATE'],
  ['<published>2026-11-11T12:00:00</published>', 'INVALID_DATE'],
  ['<published>2026-02-30T12:00:00Z</published>', 'INVALID_DATE'],
  ['<pubDate>Mon, 30 Feb 2026 12:00:00 GMT</pubDate>', 'INVALID_DATE'],
  ['<published><b>2026-11-11T12:00:00Z</b></published>', 'INVALID_DATE'],
  ['<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]><published>&x;</published>', 'INVALID_DATE'],
  ['<x>'.repeat(40) + '</x>'.repeat(40), 'INVALID_DATE'],
  ['x'.repeat(1024 * 1024 + 1), 'INVALID_DATE'],
  ['<updated type="text">2026-11-11T12:00:00Z</updated>', 'UPDATED_ONLY'],
  ['<published>2026-11-11T14:00:00+02:00</published>', 'RECENT'],
  ['<item><published>2026-11-11T12:00:00Z</published></item>', 'RECENT'],
  ['<published>2026-11-11T12:00:00Z</published><published>bad</published>', 'INVALID_DATE']
] as const) assert.equal(assessFeedPublication(xml, now).decision, expected, xml.slice(0,100));
assert.equal(assessFeedPublication('<published xmlns="urn:unrelated">2026-11-11T12:00:00Z</published>', now).decision, 'MISSING_DATE');
assert.equal(assessFeedPublication('<atom:entry xmlns:atom="http://www.w3.org/2005/Atom"><atom:published>2026-11-11T12:00:00Z</atom:published></atom:entry>', now).decision, 'RECENT');

const namespaceFlood = '<entry ' + Array.from({length:33}, (_,i) => `xmlns:n${i}="urn:${i}"`).join(' ') + '><published>2026-11-11T12:00:00Z</published></entry>';
assert.equal(assessFeedPublication(namespaceFlood, now).decision, 'INVALID_DATE');
