// Small non-validating XML reader. No DTDs, entities, external resources or recursion.
// Limits apply even when a test injects its transport. Unknown entities reject the feed.
export interface FeedXmlNode {
  name: string;
  rawName?: string;
  namespaces?: Record<string, string>;
  text: string;
  children: FeedXmlNode[];
  attributes: Record<string, string>;
}
export function decodeFeedText(text: string): string {
  return text.replace(/&([^;\s<&]+);/g, (_all, entity: string) => {
    const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (Object.hasOwn(named, entity)) return named[entity];
    const n = /^#x[0-9a-f]+$/i.test(entity) ? parseInt(entity.slice(2),16) : /^#\d+$/.test(entity) ? Number(entity.slice(1)) : NaN;
    if (!Number.isInteger(n) || n < 32 && ![9,10,13].includes(n) || n > 0x10ffff || n >= 0xd800 && n <= 0xdfff) throw Error('INVALID_FEED_XML');
    return String.fromCodePoint(n);
  });
}
export function parseFeedXml(xml: string): FeedXmlNode {
  if (Buffer.byteLength(xml, 'utf8') > 1024 * 1024) throw Error('FEED_TOO_LARGE');
  const root: FeedXmlNode = { name: '', text: '', children: [], attributes: {} };
  const stack = [root];
  let pos = 0, nodes = 0;
  while (pos < xml.length) {
    const current = stack[stack.length - 1];
    if (xml[pos] !== '<') {
      const end = xml.indexOf('<', pos);
      const next = end < 0 ? xml.length : end;
      current.text += decodeFeedText(xml.slice(pos, next)); pos = next; continue;
    }
    const skip = (prefix: string, suffix: string) => {
      if (!xml.startsWith(prefix, pos)) return false;
      const end = xml.indexOf(suffix, pos + prefix.length);
      if (end < 0) throw Error('INVALID_FEED_XML');
      if (prefix === '<![CDATA[') current.text += xml.slice(pos + prefix.length, end);
      pos = end + suffix.length; return true;
    };
    if (skip('<!--','-->') || skip('<![CDATA[',']]>') || skip('<?','?>')) continue;
    if (xml.startsWith('<!',pos)) throw Error('INVALID_FEED_XML');
    // Sticky tokenization avoids repeated scans from every opening angle bracket.
    const token = /<\/?[A-Za-z_][\w.:-]*(?:\s+[A-Za-z_][\w.:-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*\s*\/?>/y;
    token.lastIndex = pos;
    const match = token.exec(xml);
    if (!match) throw Error('INVALID_FEED_XML');
    const raw = match[0]; pos = token.lastIndex;
    const name = /^<\/?([^\s/>]+)/.exec(raw)![1];
    if (raw.startsWith('</')) {
      if (!/^<\/[^\s>]+\s*>$/.test(raw) || stack.length === 1 || (current.rawName ?? current.name) !== name) throw Error('INVALID_FEED_XML');
      stack.pop(); continue;
    }
    if (++nodes > 20000 || stack.length > 32) throw Error('FEED_XML_LIMIT');
    const node: FeedXmlNode = { name, text: '', children: [], attributes: {} };
    for (const attr of raw.matchAll(/([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      if (Object.hasOwn(node.attributes, attr[1])) throw Error('INVALID_FEED_XML');
      Object.defineProperty(node.attributes, attr[1], {value: decodeFeedText(attr[2] ?? attr[3]), enumerable: true});
    }
    const namespaces = {...current.namespaces};
    for (const [key, value] of Object.entries(node.attributes)) {
      if (key === 'xmlns') namespaces[''] = value;
      else if (key.startsWith('xmlns:')) namespaces[key.slice(6)] = value;
    }
    // Bound inherited namespace copies as well as depth/node count (prevents amplification).
    if (Object.keys(namespaces).length > 32) throw Error('FEED_XML_LIMIT');
    node.namespaces = namespaces;
    node.rawName = name;
    const parts = name.split(':');
    const namespace = namespaces[parts.length === 2 ? parts[0] : ''];
    const local = parts[parts.length - 1];
    // Deliberately support RSS 2.0 and Atom only; unrelated extension tags cannot supply evidence.
    node.name = parts.length > 2 || (parts.length === 2 && !namespace) ||
      namespace && namespace !== 'http://www.w3.org/2005/Atom' ? '{UNSUPPORTED}' + name : local;
    current.children.push(node);
    if (!raw.endsWith('/>')) stack.push(node);
  }
  if (stack.length !== 1) throw Error('INVALID_FEED_XML');
  return root;
}
export function feedEntries(root: FeedXmlNode): FeedXmlNode[] {
  // Only actual RSS channel items and Atom feed entries; never entries hidden in content.
  return root.children.flatMap(top => top.name === 'rss'
    ? top.children.filter(c => c.name === 'channel').flatMap(c => c.children.filter(e => e.name === 'item'))
    : top.name === 'feed' ? top.children.filter(e => e.name === 'entry') : [] ).slice(0,40);
}
