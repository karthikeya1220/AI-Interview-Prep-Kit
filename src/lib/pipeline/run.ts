import { jsonCompletion } from "@/lib/llm/openrouter";
import { researchCompany, type ResearchPage } from "@/lib/retrieval/company";
import type { Flashcard, Kit, PipelineInput, Question, QuestionCategory, Requirement } from "@/lib/types";
import { validateKit } from "@/lib/validation/kit";
import { checkCoverage } from "./coverage";
import { extractRoleHeuristics } from "./extractRequirements";
import { buildSchedule } from "./schedule";

type RawRequirement = { text?: unknown; kind?: unknown; priority?: unknown } | string;
type RawRole = { title?: unknown; seniority?: unknown; location?: unknown; responsibilities?: unknown; requirements?: unknown };
type RawQuestion = { requirement_ids?: unknown; category?: unknown; prompt?: unknown; answer_outline?: unknown; difficulty?: unknown };

const fallbackRequirements = extractRoleHeuristics;

const ALL_CATEGORIES: QuestionCategory[] = ["technical", "behavioural", "system-design", "company-fit"];

/** Per-category angle so prompts don't collapse into the same rephrased question. */
const CATEGORY_GUIDANCE: Record<QuestionCategory, string> = {
  technical: "Probe technical depth on the requirement itself: internals, trade-offs, failure modes. Do not ask about company culture or use 'tell me about a time'.",
  behavioural: "Past-behaviour STAR stories only: phrase as 'Tell me about a time when…' tied to the requirement. Do not ask generic technical how-to questions.",
  "system-design": "Design/scenario prompts that exercise the requirement at scale: constraints, components, trade-offs, operations. Ask the candidate to walk through a design, not recite experience.",
  "company-fit":
    "Questions must be about THIS company and how the candidate fits its culture, values, work style, mission, and hiring process — drawn from the research context. " +
    "Target different anchors across questions (values, remote/async style, interview process if present, mission, how the team works) — do not template every question as '<requirement> aligns with…'. " +
    "Do NOT rephrase the technical requirements as the question. Prefer requirement_ids: [] unless a behavioural or domain requirement genuinely applies.",
};

/**
 * Budgeted research text for LLM prompts. Head-slices alone miss culture
 * copy buried mid-page (PostHog's SuperDay blurb sits ~5.7k chars in), so
 * seed the budget with keyword windows (interview, values, remote…), then
 * fill the rest with score-ordered page heads (careers/handbook first).
 */
const CONTEXT_TERMS = [
  "no live coding",
  "culture interview",
  "superday",
  "interview process",
  "meeting-free",
  "transparency",
  "autonomy",
  "values",
  "remote-first",
  "async",
  "handbook",
  "hiring",
  "culture",
  "mission",
];

export function researchContext(pages: ResearchPage[], limit: number): string {
  if (!pages.length || limit <= 0) return "";
  const score = (page: ResearchPage) => {
    const hay = `${page.url} ${page.title}`.toLowerCase();
    return ["careers", "hiring", "interview", "handbook", "values", "culture", "about", "team", "engineering"].reduce(
      (n, word) => n + (hay.includes(word) ? 1 : 0),
      0,
    );
  };
  const ordered = [...pages].sort((a, b) => score(b) - score(a) || pages.indexOf(a) - pages.indexOf(b));
  const parts: string[] = [];
  const seen = new Set<string>();
  let remaining = limit;

  const push = (chunk: string) => {
    if (!chunk || remaining <= 0) return false;
    const key = chunk.slice(0, 80);
    if (seen.has(key)) return true;
    seen.add(key);
    const slice = chunk.slice(0, remaining);
    parts.push(slice);
    remaining -= slice.length + 2;
    return remaining > 0;
  };

  // Keyword windows first: guarantee buried culture/hiring snippets are present.
  for (const page of ordered) {
    const lower = page.text.toLowerCase();
    for (const term of CONTEXT_TERMS) {
      const at = lower.indexOf(term);
      if (at < 0) continue;
      const start = Math.max(0, at - 80);
      if (!push(`${page.title}: …${page.text.slice(start, at + 420)}…`)) return parts.join("\n\n");
    }
  }

  // Then equal-ish head slices in score order for identity context.
  const perPage = Math.max(300, Math.floor(remaining / Math.max(1, ordered.length)));
  for (const page of ordered) {
    if (remaining <= 0) break;
    push(`${page.title}\n${page.text.slice(0, perPage)}`);
  }
  return parts.join("\n\n");
}

/** Optional progress callback; `fields` are partial kit pieces persisted as they complete. */
export type PipelineStep = (step: string, fields?: Record<string, unknown>) => void | Promise<void>;

async function extractRole(jd: string) {
  return jsonCompletion(
    "Extract only facts present in the job description. Do not invent requirements. Aim for 6-10 requirements spanning technical skills, domain knowledge, and work-style expectations the JD explicitly states for the candidate.",
    `Return JSON: {"title":"","seniority":"","location":"","responsibilities":[""],"requirements":[{"text":"","kind":"technical|behavioural|domain","priority":"must|nice"}]}\nJD:\n${jd.slice(0, 12000)}`,
    () => fallbackRequirements(jd),
  ).then((data: RawRole) => {
    const fallback = fallbackRequirements(jd);
    const requirements = Array.isArray(data.requirements) ? data.requirements : fallback.requirements;
    return {
      title: String(data.title || fallback.title),
      seniority: String(data.seniority || fallback.seniority),
      location: String(data.location || fallback.location),
      responsibilities: Array.isArray(data.responsibilities) ? data.responsibilities.map(String).slice(0, 8) : fallback.responsibilities,
      requirements: (requirements as RawRequirement[]).map((r, i) => {
        const object = typeof r === "object" && r !== null ? r : {};
        const text = typeof r === "string" ? r : String(object.text || "");
        const kind = ["technical", "behavioural", "domain"].includes(String(object.kind)) ? String(object.kind) as Requirement["kind"] : "technical";
        const priority = object.priority === "nice" ? "nice" as const : "must" as const;
        return { id: `r${i + 1}`, text: text.slice(0, 180), kind, priority };
      }).filter((r) => r.text).slice(0, 12) as Requirement[],
    };
  });
}

function fallbackQuestions(requirements: Requirement[], category: QuestionCategory, offset = 0, company = ""): Question[] {
  return requirements.filter((r) => category === "company-fit" || (category === "system-design" ? r.kind === "technical" : r.kind === category)).slice(0, 5).map((r, index) => ({
    id: `q${offset + index + 1}`,
    requirement_ids: [r.id],
    category,
    prompt:
      category === "behavioural"
        ? `Tell me about a time you demonstrated: ${r.text}`
        : category === "system-design"
          ? `Design a solution that requires ${r.text} at scale — walk through architecture, trade-offs, and failure modes.`
          : category === "company-fit"
            ? company
              ? `Why ${company}, and how does their culture and way of working fit you — considering expectations like: ${r.text}?`
              : `How do this company's culture and your way of working fit together — considering expectations like: ${r.text}?`
            : `How would you apply ${r.text} in this role?`,
    answer_outline:
      category === "company-fit"
        ? "Connect company values and work style from your research to a concrete example from your experience; be honest about trade-offs."
        : "Explain the situation, trade-offs, concrete actions, and measurable outcome.",
    difficulty: r.priority === "must" ? 2 : 1,
    meta: { origin: "generated" },
  }));
}

function normalizeQuestions(batch: { questions?: RawQuestion[] } | undefined, category: QuestionCategory): Question[] {
  return (batch?.questions || []).map((q: RawQuestion) => ({
    requirement_ids: Array.isArray(q.requirement_ids) ? q.requirement_ids.map(String) : [],
    category,
    prompt: String(q.prompt || ""),
    answer_outline: String(q.answer_outline || ""),
    difficulty: q.difficulty === 3 ? 3 : q.difficulty === 1 ? 1 : 2,
    meta: { origin: "generated" },
  })).filter((q) => q.prompt.trim()) as Question[];
}

async function questionsForCategory(requirements: Requirement[], company: string, pagesText: string, category: QuestionCategory, offset: number): Promise<Question[]> {
  const researchLimit = category === "company-fit" ? 6000 : 2500;
  const research = pagesText.trim()
    ? `Research context:\n${pagesText.slice(0, researchLimit)}`
    : "Research context: unavailable — use only the company name; do not invent company-specific facts.";
  // Company-fit is judged on culture/work-style fit, not coverage of technical ids;
  // other categories must keep requirement ids so coverage can pass.
  const requirementLine =
    category === "company-fit"
      ? `Role expectations (context only — never the subject of the question): ${JSON.stringify(requirements.slice(0, 8))}`
      : `Requirements: ${JSON.stringify(requirements)}\nEvery question must reference the requirement ids it covers.`;
  const batch = await jsonCompletion<{ questions: Omit<Question, "id" | "meta">[] }>(
    `Generate interview questions for exactly one category.\nCategory rules: ${CATEGORY_GUIDANCE[category]}\nEach question must take a distinct angle; do not ask the same thing rephrased.`,
    `Company: ${company}\nCategory: ${category}\n${requirementLine}\n${research}\nReturn {"questions":[{"requirement_ids":["r1"],"category":"${category}","prompt":"","answer_outline":"","difficulty":1}]}`,
    () => ({ questions: fallbackQuestions(requirements, category, offset, company) }),
  );
  return normalizeQuestions(batch, category);
}

/** Generate questions for one or more categories; ids continue from `offset`. */
export async function generateQuestionsStep(requirements: Requirement[], company: string, pagesText: string, categories: QuestionCategory[] = ALL_CATEGORIES, offset = 0): Promise<Question[]> {
  const batches: Question[][] = [];
  let cursor = offset;
  for (const category of categories) {
    const batch = await questionsForCategory(requirements, company, pagesText, category, cursor);
    cursor += batch.length;
    batches.push(batch);
  }
  return batches.flat().map((q, i) => ({ ...q, id: `q${offset + i + 1}` }));
}

/** Gap pass: generate questions for uncovered must-have requirements, then re-check. */
export async function ensureCoverageStep(requirements: Requirement[], questions: Question[]): Promise<{ questions: Question[]; uncovered: string[] }> {
  const uncovered = checkCoverage(requirements, questions);
  if (!uncovered.length) return { questions, uncovered };
  const missing = requirements.filter((r) => uncovered.includes(r.id));
  const start = questions.length;
  const generated = await jsonCompletion<{ questions: Omit<Question, "id" | "meta">[] }>(
    "Generate missing interview questions. Each missing must-have requirement needs at least one question referencing its id.",
    `Missing requirements: ${JSON.stringify(missing)}\nReturn {"questions":[{"requirement_ids":["r1"],"category":"technical","prompt":"","answer_outline":"","difficulty":2}]}`,
    () => ({ questions: fallbackQuestions(missing, "technical", start) }),
  );

  const raw = (generated.questions || []).length ? generated.questions : [];
  const normalized = raw
    .map((q: RawQuestion) => normalizeQuestions({ questions: [q] }, (["technical", "behavioural", "system-design", "company-fit"].includes(String(q.category)) ? String(q.category) : "technical") as QuestionCategory)[0])
    .filter((q): q is Question => Boolean(q));
  // If the model produced nothing usable for the gap pass, close the gap deterministically.
  const source = normalized.length ? normalized : fallbackQuestions(missing, "technical", start);
  const gaps = source.map((q, i) => ({ ...q, id: `q${start + i + 1}` })) as Question[];
  const merged = questions.concat(gaps);
  return { questions: merged, uncovered: checkCoverage(requirements, merged) };
}

/** Retrieval + company brief, reused by full runs and section regeneration. */
export async function companyBriefStep(company_url: string) {
  const research = await researchCompany(company_url);
  // Homepage-first text keeps the brief grounded in what the company does;
  // questionContext leads with careers/hiring/handbook so culture reaches prompts.
  const pagesText = research.pages.map((p) => `${p.title}\n${p.text}`).join("\n\n");
  const questionContext = researchContext(research.pages, 8000);
  const brief = await jsonCompletion<{ summary: string; what_they_do: string }>(
    "Write an honest company brief from retrieved source text. If sources are thin, say so.",
    `Company: ${research.company}\nPages:\n${pagesText.slice(0, 10000)}\nReturn {"summary":"","what_they_do":""}`,
    () => ({ summary: research.pages.length ? `${research.company} overview based on retrieved site text.` : "Company research was unavailable or unreachable.", what_they_do: research.pages[0]?.text.slice(0, 400) || "No reliable source text was retrieved." }),
  );
  return { research, pagesText, questionContext, brief: { summary: String(brief.summary || ""), what_they_do: String(brief.what_they_do || "") } };
}

/** Flashcards, reused by full runs and section regeneration. */
export async function generateFlashcardsStep(requirements: Requirement[]): Promise<Flashcard[]> {
  const deterministic = () => requirements.slice(0, 10).map((r) => ({ front: `Key idea: ${r.text}`, back: "Prepare a concrete example, trade-offs, and outcome.", requirement_ids: [r.id] }));
  const data = await jsonCompletion<{ flashcards: Omit<Flashcard, "id" | "meta">[] }>(
    "Create concise interview prep flashcards from requirements.",
    `Requirements: ${JSON.stringify(requirements)}\nReturn {"flashcards":[{"front":"","back":"","requirement_ids":["r1"]}]}`,
    () => ({ flashcards: deterministic() }),
  );
  // Models occasionally omit required fields on individual items; drop unusable
  // cards instead of letting one malformed card fail final kit validation.
  const usable = (data.flashcards || []).filter(
    (f) => typeof f?.front === "string" && f.front.trim() && typeof f?.back === "string" && f.back.trim(),
  );
  const source = usable.length ? usable : deterministic();
  return source.map((f, i) => ({
    front: String(f.front),
    back: String(f.back),
    requirement_ids: Array.isArray(f.requirement_ids) ? f.requirement_ids.map(String) : [],
    id: `f${i + 1}`,
    meta: { origin: "generated" },
  })) as Flashcard[];
}

export async function runPipeline(input: PipelineInput, onStep?: PipelineStep) {
  if (!input.jd?.trim()) throw Object.assign(new Error("Job description is required"), { code: "INVALID_INPUT" });
  // Progress persistence must never fail the pipeline itself.
  const step = async (name: string, fields?: Record<string, unknown>) => {
    try {
      await onStep?.(name, fields);
    } catch (error) {
      console.warn(`progress step "${name}" failed`, error);
    }
  };
  const role = await extractRole(input.jd);
  await step("extract requirements", { role });
  const { research, questionContext, brief } = await companyBriefStep(input.company_url);
  await step("research company", {
    source: { company: research.company, company_url: input.company_url, role: role.title, location: role.location, jd_chars: input.jd.length, researched_at: new Date().toISOString(), pages_used: research.pages.map((p) => p.url) },
    research_notes: research.warnings,
  });
  await step("company brief", { company_brief: { summary: brief.summary, what_they_do: brief.what_they_do, sources: research.pages.map((p) => p.url), meta: { origin: "generated" } } });
  let questions = await generateQuestionsStep(role.requirements, research.company, questionContext);
  await step("questions", { questions });
  const coverage = await ensureCoverageStep(role.requirements, questions);
  questions = coverage.questions;
  await step("coverage check", { coverage: { uncovered_requirement_ids: coverage.uncovered, passes: coverage.uncovered.length ? 2 : 1 } });
  const flashcards = await generateFlashcardsStep(role.requirements);
  await step("flashcards", { flashcards });
  const schedule = buildSchedule({ role, questions }, input.days);
  await step("schedule", { schedule });
  const kit: Kit = {
    source: { company: research.company, company_url: input.company_url, role: role.title, location: role.location, jd_chars: input.jd.length, researched_at: new Date().toISOString(), pages_used: research.pages.map((p) => p.url) },
    company_brief: { summary: brief.summary, what_they_do: brief.what_they_do, sources: research.pages.map((p) => p.url), meta: { origin: "generated" } },
    role,
    questions,
    flashcards,
    schedule,
    coverage: { uncovered_requirement_ids: coverage.uncovered, passes: coverage.uncovered.length ? 2 : 1 },
    research_notes: research.warnings,
  };
  const valid = validateKit(kit);
  if (!valid.ok) throw Object.assign(new Error(valid.error), { code: "KIT_INVALID" });
  return { kit, warnings: research.warnings };
}
