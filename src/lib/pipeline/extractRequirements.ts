import type { Requirement, RequirementKind, RequirementPriority } from "@/lib/types";

const NICE_PATTERN = /\bbonus\b|\bnice[- ]to[- ]have\b|\bpreferred\b|\bdesirable\b|\ba\s+plus\b|\bplus\b|\badvantageous\b/i;
const MUST_PATTERN = /\brequired\b|\bmust\b|\bminimum\b|\bat\s+least\b|\bproficient\b|\bexpertise\b|\bexperience\b|\bstrong\b|\bdeep\b|\bfluent\b|\d+\+?\s*years?\b/i;
const BEHAVIOURAL_PATTERN = /\blead\b|\bmentor|\bcommunicat|\bcollaborat|\bstakeholder|\bmanage|\bcoach|\bcross[- ]functional/i;
const DOMAIN_PATTERN = /\bindustry\b|\bdomain\b|\bfintech\b|\bhealth\b|\bmarketplace\b|\be-?commerce\b|\bregulat|\bcompliance\b/i;
const RESPONSIBILITY_PATTERN = /\b(responsible|build|design|lead|own|drive|deliver|ship|maintain|collaborate|mentor|manage|partner|define)\b/i;
const TITLE_PATTERN = /\b(?:(?:senior|junior|jr\.?|sr\.?|staff|principal|lead|head\s+of)\s+)?[a-z][a-z+#./]*(?:\s+[a-z][a-z+#./]*){0,2}\s+(?:engineer(?:ing)?|developer|designer|manager|architect|scientist|analyst|administrator|specialist|consultant|programmer)s?\b/i;
const REQUIREMENT_LABEL_PATTERN = /^(?:required(?:\s+qualifications)?|requirements|must[- ]haves?|nice[- ]to[- ]haves?|bonus(?:\s+points)?|preferred(?:\s+qualifications)?|responsibilities|qualifications)\s*[:\-]\s*/i;

function clean(text: string): string {
  return text.replace(/\s+/g, " ").replace(/[.,;:]+$/, "").trim().slice(0, 80);
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Split a JD into clause-sized pieces: lines, then sentences and bullet items. */
export function splitClauses(jd: string): string[] {
  return jd
    .split(/\r?\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z0-9(])|\s*[;•]\s*/))
    .map((clause) => clause.replace(/^\s*[-*•\d.)]+\s*/, "").trim())
    .filter(Boolean);
}

function toRequirement(clause: string): Omit<Requirement, "id"> | null {
  const nice = NICE_PATTERN.test(clause);
  const text = clean(clause.replace(REQUIREMENT_LABEL_PATTERN, ""));
  if (!text) return null;
  const kind: RequirementKind = BEHAVIOURAL_PATTERN.test(clause) ? "behavioural" : DOMAIN_PATTERN.test(clause) ? "domain" : "technical";
  const priority: RequirementPriority = nice ? "nice" : "must";
  return { text, kind, priority };
}

function dedupe(items: Array<Omit<Requirement, "id">>): Array<Omit<Requirement, "id">> {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalize(item.text);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractTitle(clauses: string[]): string {
  for (const clause of clauses.slice(0, 6)) {
    const labeled = clause.match(/^(?:job\s*title|role|position|title)\s*[:\-]\s*(.+)$/i);
    if (labeled) return clean(labeled[1]);
    const match = clause.match(TITLE_PATTERN);
    if (match) return clean(match[0]);
  }
  return clauses[0] ? clauses[0].split(/\s+/).slice(0, 8).join(" ") : "Unknown role";
}

/**
 * Deterministic requirement extraction from a job description.
 * Used as the LLM fallback and for tests; never invents facts not present in the JD.
 */
export function extractRoleHeuristics(jd: string): {
  title: string;
  seniority: string;
  location: string;
  responsibilities: string[];
  requirements: Requirement[];
} {
  const clauses = splitClauses(jd);
  const title = extractTitle(clauses);
  const titleNorm = normalize(title);
  const bodyClauses = clauses.filter((clause) => normalize(clause) !== titleNorm);

  let candidates = bodyClauses.filter((clause) => MUST_PATTERN.test(clause) || NICE_PATTERN.test(clause));
  if (!candidates.length) candidates = bodyClauses.slice(0, 3);

  const requirements = dedupe(candidates.map(toRequirement).filter((r): r is Omit<Requirement, "id"> => r !== null))
    .slice(0, 8)
    .map((r, index) => ({ ...r, id: `r${index + 1}` }));

  const responsibilities = bodyClauses.filter((clause) => RESPONSIBILITY_PATTERN.test(clause)).slice(0, 4);

  return {
    title,
    seniority: /senior|staff|principal|lead/i.test(title) ? "senior" : /junior|\bjr\b|entry/i.test(title) ? "junior" : "unspecified",
    location: "",
    responsibilities: responsibilities.length ? responsibilities.map(clean).filter(Boolean) : clauses.slice(1, 3).map(clean).filter(Boolean),
    requirements,
  };
}
