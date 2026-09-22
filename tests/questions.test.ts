import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateQuestionsStep, researchContext } from "../src/lib/pipeline/run";
import { jsonCompletion } from "../src/lib/llm/openrouter";
import type { Question, Requirement } from "../src/lib/types";
import type { ResearchPage } from "../src/lib/retrieval/company";

const requirements: Requirement[] = [
  { id: "r1", text: "OLAP database internals", kind: "technical", priority: "must" },
  { id: "r2", text: "Mentor juniors", kind: "behavioural", priority: "must" },
];

vi.mock("../src/lib/llm/openrouter", () => ({ jsonCompletion: vi.fn() }));

const mockJson = vi.mocked(jsonCompletion);

beforeEach(() => {
  vi.clearAllMocks();
});

function lastCall() {
  const call = mockJson.mock.calls.at(-1);
  return { system: String(call?.[0] ?? ""), user: String(call?.[1] ?? "") };
}

/** Simulate LLM failure: jsonCompletion's real implementation would invoke the fallback. */
function failOverToFallback() {
  mockJson.mockImplementationOnce(((_system: string, _user: string, fallback: () => unknown) => fallback()) as never);
}

describe("researchContext", () => {
  it("seeds keyword windows so buried culture snippets (SuperDay) survive head budgets", () => {
    const buried = `${"filler ".repeat(900)}Paid SuperDay trial, no live coding interviews ${"tail ".repeat(200)}`;
    const pages: ResearchPage[] = [
      { url: "https://x.com/", title: "Home", text: "HOMEPAGE ".repeat(500) },
      { url: "https://x.com/about", title: "About", text: "ABOUT ".repeat(500) },
      { url: "https://x.com/careers", title: "Careers", text: buried },
    ];
    const text = researchContext(pages, 4000);
    expect(text).toContain("SuperDay");
    expect(text).toContain("no live coding");
    expect(text.indexOf("SuperDay")).toBeLessThan(text.indexOf("HOMEPAGE"));
  });

  it("spreads head slices across pages after keyword windows", () => {
    const pages: ResearchPage[] = [
      { url: "https://x.com/", title: "Home", text: "HOMEPAGE ".repeat(500) },
      { url: "https://x.com/about", title: "About", text: "ABOUT ".repeat(500) },
      { url: "https://x.com/careers", title: "Careers", text: "SuperDay culture interview async ".repeat(50) },
    ];
    const text = researchContext(pages, 3000);
    expect(text).toContain("SuperDay");
    expect(text).toContain("ABOUT");
  });

  it("returns an empty string for no pages", () => {
    expect(researchContext([], 1000)).toBe("");
  });
});

describe("generateQuestionsStep category prompts", () => {
  it("company-fit asks about culture/work-style, not requirement restatements", async () => {
    mockJson.mockResolvedValueOnce({ questions: [] } as never);
    await generateQuestionsStep(requirements, "PostHog", "Careers page: SuperDay paid trial, no live coding, async PRs > Issues > Slack", ["company-fit"]);
    const { system, user } = lastCall();
    expect(system).toMatch(/culture|values|work style/i);
    expect(system).toMatch(/Do NOT rephrase the technical requirements/i);
    expect(system).toMatch(/do not template every question/i);
    expect(user).toMatch(/never the subject/i);
    expect(user).not.toMatch(/^Requirements:/m);
    expect(user).toMatch(/SuperDay/);
  });

  it("technical prompts stay on depth and ban culture/time storytelling", async () => {
    mockJson.mockResolvedValueOnce({ questions: [] } as never);
    await generateQuestionsStep(requirements, "PostHog", "Careers page text", ["technical"]);
    const { system } = lastCall();
    expect(system).toMatch(/internals|trade-offs|failure modes/i);
    expect(system).toMatch(/Do not ask about company culture/i);
  });

  it("behavioural prompts demand STAR time-when phrasing", async () => {
    mockJson.mockResolvedValueOnce({ questions: [] } as never);
    await generateQuestionsStep(requirements, "PostHog", "", ["behavioural"]);
    const { system, user } = lastCall();
    expect(system).toMatch(/Tell me about a time when/i);
    expect(user).toMatch(/Research context: unavailable/);
  });

  it("system-design prompts ask for a design walk-through, not resume recital", async () => {
    mockJson.mockResolvedValueOnce({ questions: [] } as never);
    await generateQuestionsStep(requirements, "PostHog", "", ["system-design"]);
    const { system } = lastCall();
    expect(system).toMatch(/walk through a design/i);
    expect(system).toMatch(/not recite experience/i);
  });

  it("distinct categories produce distinct system prompts", async () => {
    mockJson.mockResolvedValue({ questions: [] } as never);
    await generateQuestionsStep(requirements, "Acme", "ctx", ["technical", "company-fit"]);
    expect(mockJson).toHaveBeenCalledTimes(2);
    expect(mockJson.mock.calls[0][0]).not.toBe(mockJson.mock.calls[1][0]);
  });
});

describe("company-fit fallback", () => {
  it("phrases questions around company culture while keeping coverage ids", async () => {
    failOverToFallback();
    const questions: Question[] = await generateQuestionsStep(requirements, "PostHog", "", ["company-fit"]);
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      expect(q.prompt).toMatch(/PostHog/);
      expect(q.prompt).toMatch(/culture|way of working/i);
      expect(q.requirement_ids.length).toBeGreaterThan(0);
      expect(q.answer_outline).toMatch(/values|work style/i);
    }
  });

  it("system-design fallback asks for scale design, not generic application", async () => {
    failOverToFallback();
    const questions: Question[] = await generateQuestionsStep([requirements[0]], "Acme", "", ["system-design"]);
    expect(questions[0]?.prompt).toMatch(/at scale|architecture/i);
  });
});
