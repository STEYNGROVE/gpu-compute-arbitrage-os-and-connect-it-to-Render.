// Explicit timezone and calendar validation before Date.parse (which normalizes invalid dates).
export function strictPublicationTimestamp(value: string, atomOnly = false): number {
  const text = value.trim();
  let year: number, month: number, day: number, hour: number, minute: number, second: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/.exec(text);
  if (iso) {
    [, year, month, day, hour, minute, second] = iso.map(Number);
    if (iso[7] !== 'Z' && (Number(iso[8]) > 23 || Number(iso[9]) > 59)) return NaN;
  } else {
    if (atomOnly) return NaN;
    const rss = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*)?(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s+(GMT|UT|[+-]\d{4})$/.exec(text);
    if (!rss) return NaN;
    year = Number(rss[4]); month = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ').indexOf(rss[3]) + 1;
    day = Number(rss[2]); hour = Number(rss[5]); minute = Number(rss[6]); second = Number(rss[7]);
    if (/^[+-]/.test(rss[8]) && (Number(rss[8].slice(1,3)) > 23 || Number(rss[8].slice(3)) > 59)) return NaN;
    if (rss[1]) {
      const localDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      if ('Sun Mon Tue Wed Thu Fri Sat'.split(' ')[localDay] !== rss[1]) return NaN;
    }
  }
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 100 || month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59) return NaN;
  return Date.parse(text);
}
