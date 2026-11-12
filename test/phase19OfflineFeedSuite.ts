import assert from 'node:assert/strict';
import { assessFeedPublication } from
  '../server/feedPublicationEvidence.js';
import { isCommercialComputeLead } from
  '../server/commercialLeadFilter.js';

const now = new Date('2026-11-12T12:00:00Z');
const feed = 'https://example.org/gpu-requests.xml';

const fixtures = [
  {
    name: 'Recent RSS buyer request',
    xml: `<item>
      <title>Seeking a GPU provider for production inference workload</title>
      <description>Need a provider to deliver hosted inference for our application.</description>
      <link>https://example.org/jobs/101</link>
      <pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate>
    </item>`,
    expected: true
  },
  {
    name: 'Recent Atom buyer request',
    xml: `<entry>
      <title>Seeking a GPU provider for batch processing</title>
      <summary>We need a provider to run our customer batch jobs.</summary>
      <link href="https://example.org/jobs/102"/>
      <published>2026-11-11T12:00:00Z</published>
    </entry>`,
    expected: true
  },
  {
    name: 'Stale buyer request',
    xml: `<item>
      <title>Seeking a GPU provider for production inference workload</title>
      <description>Need a provider to deliver hosted inference for our application.</description>
      <link>https://example.org/jobs/103</link>
      <pubDate>Sat, 01 Aug 2026 12:00:00 GMT</pubDate>
    </item>`,
    expected: false
  },
  {
    name: 'Missing publication date',
    xml: `<item>
      <title>Seeking a GPU provider for production inference workload</title>
      <description>Need a provider to deliver hosted inference for our application.</description>
      <link>https://example.org/jobs/104</link>
    </item>`,
    expected: false
  },
  {
    name: 'Future publication date',
    xml: `<item>
      <title>Seeking a GPU provider for production inference workload</title>
      <description>Need a provider to deliver hosted inference for our application.</description>
      <link>https://example.org/jobs/105</link>
      <pubDate>Sun, 15 Nov 2026 12:00:00 GMT</pubDate>
    </item>`,
    expected: false
  },
  {
    name: 'Supplier advertisement',
    xml: `<item>
      <title>GPU server rental available</title>
      <description>We offer GPU hardware rentals to customers.</description>
      <link>https://example.org/jobs/106</link>
      <pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate>
    </item>`,
    expected: false
  }
];

function field(xml: string, name: string): string {
  const expression = new RegExp(
    '<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>',
    'i'
  );
  return xml.match(expression)?.[1]?.trim() || '';
}

const acceptedUrls = new Set<string>();

function evaluate(xml: string): boolean {
  const entry = xml.match(
    /<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/i
  )?.[2];

  if (!entry) return false;

  const publication = assessFeedPublication(entry, now);
  if (!publication.eligibleForFreshReview) return false;

  const title = field(entry, 'title');
  const description =
    field(entry, 'description') || field(entry, 'summary');

  if (!isCommercialComputeLead(title, description, feed)) {
    return false;
  }

  const url =
    field(entry, 'link') ||
    entry.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ||
    '';

  if (!url.startsWith('https://')) return false;
  if (acceptedUrls.has(url)) return false;

  acceptedUrls.add(url);
  return true;
}

for (const fixture of fixtures) {
  assert.equal(
    evaluate(fixture.xml),
    fixture.expected,
    fixture.name
  );
}

assert.equal(
  evaluate(fixtures[0].xml),
  false,
  'Duplicate URL must not be accepted twice'
);

console.log(
  'PASS: 7 offline feed filtering and deduplication cases'
);
