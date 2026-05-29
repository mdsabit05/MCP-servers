import * as cheerio from 'cheerio';

export interface FetchResult {
  title: string;
  description: string;
  content: string;       // cleaned text body
  favicon: string;
  readingTimeMinutes: number;
  error?: string;
}

const WORDS_PER_MINUTE = 200;

export async function fetchAndParse(url: string): Promise<FetchResult> {
  const empty: FetchResult = {
    title: '', description: '', content: '', favicon: '', readingTimeMinutes: 0,
  };

  let html: string;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'BookmarkServer/1.0' },
    });
    if (!res.ok) return { ...empty, error: `HTTP ${res.status}` };
    html = await res.text();
  } catch (err) {
    return { ...empty, error: String(err) };
  }

  const $ = cheerio.load(html);

  // Remove noise
  $('script, style, nav, footer, header, aside, [role="banner"], [role="navigation"]').remove();

  const title = $('title').first().text().trim()
    || $('h1').first().text().trim()
    || '';

  const description = $('meta[name="description"]').attr('content')?.trim()
    || $('meta[property="og:description"]').attr('content')?.trim()
    || '';

  // Favicon
  const faviconHref = $('link[rel="icon"], link[rel="shortcut icon"]').first().attr('href') ?? '';
  let favicon = '';
  if (faviconHref) {
    try {
      favicon = new URL(faviconHref, url).toString();
    } catch {
      favicon = faviconHref;
    }
  }

  // Body text — prefer <article> or <main>, fall back to <body>
  const contentEl = $('article').first().length
    ? $('article').first()
    : $('main').first().length
      ? $('main').first()
      : $('body');

  const content = contentEl.text().replace(/\s+/g, ' ').trim();
  const wordCount = content.split(' ').filter(Boolean).length;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));

  return { title, description, content, favicon, readingTimeMinutes };
}
