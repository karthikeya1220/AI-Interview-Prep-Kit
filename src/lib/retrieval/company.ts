import * as cheerio from "cheerio";
import robotsParser from "robots-parser";

export type ResearchPage = { url: string; title: string; text: string };
export type ResearchResult = { company: string; pages: ResearchPage[]; discussion: string[]; warnings: string[] };

const KEYWORDS = ["careers", "jobs", "hiring", "interview", "process", "about", "team", "handbook", "engineering"];
const USER_AGENT = "TraoAssignmentBot/1.0";
const DISCUSSION_DOMAINS = /glassdoor|reddit|teamblind|blind\.com|levels\.fyi|indeed|careercup|interview|stackoverflow/i;
const MAX_BODY_BYTES = 1_500_000;

function isPrivateHost(hostname: string) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h === "::1" || h === "0.0.0.0" || h === "0") return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h)) return true;
  if (/^(fe80:|fd|fc)/i.test(h)) return true;
  return false;
}

function cleanText(html: string) {
  const $ = cheerio.load(html);
  $("script,style,svg,noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000);
}

async function readCappedBody(res: Response): Promise<string> {
  const length = Number(res.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) throw new Error(`Response too large (${length} bytes)`);
  if (!res.body) return (await res.text()).slice(0, MAX_BODY_BYTES);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BODY_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  try {
    await reader.cancel();
  } catch {
    /* stream already closed */
  }
  const buf = new Uint8Array(Math.min(total, MAX_BODY_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    const room = buf.byteLength - offset;
    if (room <= 0) break;
    buf.set(chunk.subarray(0, room), offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(buf);
}

async function fetchHtml(url: string, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "user-agent": USER_AGENT } });
    const type = res.headers.get("content-type") || "";
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!type.includes("text/html") && !type.includes("text/plain")) throw new Error(`Unsupported content type ${type}`);
    return await readCappedBody(res);
  } finally {
    clearTimeout(timeout);
  }
}

/** Rate-limited fetch with one backoff retry on transient failures (not 4xx). */
async function fetchHtmlWithBackoff(url: string, timeoutMs = 8000): Promise<string> {
  try {
    return await fetchHtml(url, timeoutMs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch failed";
    if (/HTTP 4\d\d/.test(message)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 600));
    return await fetchHtml(url, timeoutMs);
  }
}

/** Fetch robots.txt once per origin; fetch failure means no known rules (allow). */
function robotsGuard(origin: string) {
  let cached: Promise<(url: string) => boolean> | null = null;
  return (url: string) => {
    cached ||= (async () => {
      try {
        const robotsUrl = `${origin}/robots.txt`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(robotsUrl, { signal: controller.signal, headers: { "user-agent": USER_AGENT } }).finally(() => clearTimeout(timeout));
        if (!res.ok) return () => true;
        const parser = robotsParser(robotsUrl, await res.text());
        return (target: string) => parser.isAllowed(target, USER_AGENT) !== false;
      } catch {
        return () => true;
      }
    })();
    return cached.then((check) => check(url));
  };
}

function scoreLink(label: string) {
  return KEYWORDS.reduce((sum, word) => sum + (label.includes(word) ? 1 : 0), 0);
}

function collectSameHostLinks(html: string, root: URL, links: Map<string, number>) {
  const $ = cheerio.load(html);
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const url = new URL(href, root);
      if (url.hostname !== root.hostname) return;
      const label = `${url.pathname} ${$(el).text()}`.toLowerCase();
      const score = scoreLink(label);
      if (score > 0) links.set(url.toString(), Math.max(links.get(url.toString()) || 0, score));
    } catch {
      /* ignore malformed hrefs */
    }
  });
}

/**
 * Best-effort search of public interview discussion (Glassdoor, Reddit, Blind,
 * Levels.fyi, Indeed, etc.). Returns found source URLs, or an honest warning
 * when the search is blocked, rate-limited, or empty.
 */
export async function searchPublicDiscussion(company: string): Promise<{ sources: string[]; warning?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const query = encodeURIComponent(`"${company}" interview process`);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT },
    }).finally(() => clearTimeout(timeout));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const $ = cheerio.load(await res.text());
    const sources: string[] = [];
    $("a.result__a").each((_, el) => {
      const href = $(el).attr("href") || "";
      let target = href.startsWith("//") ? `https:${href}` : href;
      try {
        const u = new URL(target);
        const redirected = u.searchParams.get("uddg");
        if (redirected) target = decodeURIComponent(redirected);
      } catch {
        /* keep raw href */
      }
      if (/^https?:\/\//.test(target) && !/duckduckgo\.com/.test(target) && !sources.includes(target)) sources.push(target);
    });
    if (!sources.length) return { sources: [], warning: "Public interview discussion search returned no results." };
    const preferred = sources.filter((s) => DISCUSSION_DOMAINS.test(s));
    return { sources: [...preferred, ...sources.filter((s) => !preferred.includes(s))].slice(0, 5) };
  } catch (error) {
    return { sources: [], warning: `Public interview discussion search unavailable: ${error instanceof Error ? error.message : "request failed"}` };
  }
}

/** Fetch top discussion pages so their text can shape company-fit questions (best-effort). */
async function fetchDiscussionPages(sources: string[]): Promise<ResearchPage[]> {
  const pages: ResearchPage[] = [];
  for (const url of sources.filter((s) => DISCUSSION_DOMAINS.test(s)).slice(0, 2)) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const html = await fetchHtmlWithBackoff(url, 6000);
      const $ = cheerio.load(html);
      pages.push({ url, title: $("title").text().trim() || url, text: cleanText(html) });
    } catch {
      /* discussion fetch is optional — skip on block/timeout */
    }
  }
  return pages;
}

export async function researchCompany(companyUrl: string): Promise<ResearchResult> {
  const warnings: string[] = [];
  let root: URL;
  try {
    root = new URL(companyUrl);
    if (!["http:", "https:"].includes(root.protocol)) throw new Error("URL must use http or https");
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRIVATE_URLS !== "true" && isPrivateHost(root.hostname)) throw new Error("Private URLs are blocked in production");
  } catch (error) {
    const discussion = await searchPublicDiscussion(companyUrl);
    const discussionPages = await fetchDiscussionPages(discussion.sources);
    return {
      company: "Unknown company",
      pages: discussionPages,
      discussion: discussion.sources,
      warnings: [
        `Invalid company URL: ${error instanceof Error ? error.message : "unknown error"}`,
        ...(discussion.warning ? [discussion.warning] : discussion.sources.map((s) => `Public discussion source: ${s}`)),
      ],
    };
  }

  try {
    const html = await fetchHtmlWithBackoff(root.toString());
    const $ = cheerio.load(html);
    const company = ($("meta[property='og:site_name']").attr("content") || $("title").text() || root.hostname).trim();
    const discussionPromise = searchPublicDiscussion(company);
    const robotsAllowed = robotsGuard(root.origin);
    const links = new Map<string, number>();
    collectSameHostLinks(html, root, links);

    const homepage: ResearchPage = { url: root.toString(), title: $("title").text().trim(), text: cleanText(html) };
    const pages: ResearchPage[] = [homepage];
    const fetched = new Set<string>([root.toString()]);

    const ranked = [...links.entries()].sort((a, b) => b[1] - a[1]).map(([url]) => url);
    const firstWave = ranked.slice(0, 4);
    for (const url of firstWave) {
      if (fetched.has(url)) continue;
      if (!(await robotsAllowed(url))) {
        warnings.push(`Respected robots.txt: skipped ${url}`);
        fetched.add(url);
        continue;
      }
      try {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const pageHtml = await fetchHtmlWithBackoff(url);
        fetched.add(url);
        const page = cheerio.load(pageHtml);
        pages.push({ url, title: page("title").text().trim(), text: cleanText(pageHtml) });
        // Depth-2: hiring pages buried behind /about → /careers (GitLab/PostHog-style).
        collectSameHostLinks(pageHtml, root, links);
      } catch (error) {
        fetched.add(url);
        warnings.push(`Skipped ${url}: ${error instanceof Error ? error.message : "fetch failed"}`);
      }
    }

    const secondWave = [...links.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([url]) => url)
      .filter((url) => !fetched.has(url))
      .slice(0, 2);
    for (const url of secondWave) {
      if (!(await robotsAllowed(url))) {
        warnings.push(`Respected robots.txt: skipped ${url}`);
        continue;
      }
      try {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const pageHtml = await fetchHtmlWithBackoff(url);
        fetched.add(url);
        const page = cheerio.load(pageHtml);
        pages.push({ url, title: page("title").text().trim(), text: cleanText(pageHtml) });
      } catch (error) {
        warnings.push(`Skipped ${url}: ${error instanceof Error ? error.message : "fetch failed"}`);
      }
    }

    if (pages.length === 1) warnings.push("No discoverable about, careers, hiring, or interview page found.");

    const discussion = await discussionPromise;
    if (discussion.warning) warnings.push(discussion.warning);
    else warnings.push(...discussion.sources.map((s) => `Public discussion source: ${s}`));

    const discussionPages = await fetchDiscussionPages(discussion.sources);
    for (const page of discussionPages) warnings.push(`Fetched public discussion: ${page.url}`);

    return { company, pages: [...pages, ...discussionPages], discussion: discussion.sources, warnings };
  } catch (error) {
    const discussion = await searchPublicDiscussion(root.hostname);
    if (discussion.warning) warnings.push(discussion.warning);
    else warnings.push(...discussion.sources.map((s) => `Public discussion source: ${s}`));
    const discussionPages = await fetchDiscussionPages(discussion.sources);
    warnings.push(`Company site unreachable: ${error instanceof Error ? error.message : "fetch failed"}`);
    return { company: root.hostname, pages: discussionPages, discussion: discussion.sources, warnings };
  }
}
