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
