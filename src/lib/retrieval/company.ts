import * as cheerio from "cheerio";
import robotsParser from "robots-parser";

export type ResearchPage = { url: string; title: string; text: string };
export type ResearchResult = { company: string; pages: ResearchPage[]; discussion: string[]; warnings: string[] };

const KEYWORDS = ["careers", "jobs", "hiring", "interview", "process", "about", "team", "handbook", "engineering"];
const USER_AGENT = "TraoAssignmentBot/1.0";
const DISCUSSION_DOMAINS = /glassdoor|reddit|teamblind|blind\.com|levels\.fyi|indeed|careercup|interview|stackoverflow/i;

function isPrivateHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("10.") || hostname.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
}

function cleanText(html: string) {
  const $ = cheerio.load(html);
  $("script,style,svg,noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000);
}

async function fetchHtml(url: string, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "user-agent": USER_AGENT } });
    const type = res.headers.get("content-type") || "";
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!type.includes("text/html") && !type.includes("text/plain")) throw new Error(`Unsupported content type ${type}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
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
      } catch {}
      if (/^https?:\/\//.test(target) && !/duckduckgo\.com/.test(target) && !sources.includes(target)) sources.push(target);
    });
    if (!sources.length) return { sources: [], warning: "Public interview discussion search returned no results." };
    const preferred = sources.filter((s) => DISCUSSION_DOMAINS.test(s));
    return { sources: [...preferred, ...sources.filter((s) => !preferred.includes(s))].slice(0, 5) };
  } catch (error) {
    return { sources: [], warning: `Public interview discussion search unavailable: ${error instanceof Error ? error.message : "request failed"}` };
  }
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
    return { company: "Unknown company", pages: [], discussion: discussion.sources, warnings: [`Invalid company URL: ${error instanceof Error ? error.message : "unknown error"}`, ...(discussion.warning ? [discussion.warning] : discussion.sources.map((s) => `Public discussion source: ${s}`))] };
  }

  try {
    const html = await fetchHtml(root.toString());
    const $ = cheerio.load(html);
    const company = ($("meta[property='og:site_name']").attr("content") || $("title").text() || root.hostname).trim();
    const discussionPromise = searchPublicDiscussion(company);
    const robotsAllowed = robotsGuard(root.origin);
    const links = new Map<string, number>();
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      try {
        const url = new URL(href, root);
        if (url.hostname !== root.hostname) return;
        const label = `${url.pathname} ${$(el).text()}`.toLowerCase();
        const score = KEYWORDS.reduce((sum, word) => sum + (label.includes(word) ? 1 : 0), 0);
        if (score > 0) links.set(url.toString(), score);
      } catch {}
    });
    const ranked = [...links.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([url]) => url);
    const pages: ResearchPage[] = [{ url: root.toString(), title: $("title").text().trim(), text: cleanText(html) }];
    for (const url of ranked) {
      if (!(await robotsAllowed(url))) {
        warnings.push(`Respected robots.txt: skipped ${url}`);
        continue;
      }
      try {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const pageHtml = await fetchHtml(url);
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
    return { company, pages, discussion: discussion.sources, warnings };
  } catch (error) {
    const discussion = await searchPublicDiscussion(root.hostname);
    if (discussion.warning) warnings.push(discussion.warning);
    else warnings.push(...discussion.sources.map((s) => `Public discussion source: ${s}`));
    warnings.push(`Company site unreachable: ${error instanceof Error ? error.message : "fetch failed"}`);
    return { company: root.hostname, pages: [], discussion: discussion.sources, warnings };
  }
}
