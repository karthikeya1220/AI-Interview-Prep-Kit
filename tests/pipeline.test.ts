import { describe, expect, it } from "vitest";
import { checkCoverage } from "../src/lib/pipeline/coverage";
import { buildSchedule } from "../src/lib/pipeline/schedule";
import { extractRoleHeuristics } from "../src/lib/pipeline/extractRequirements";
import { validateKit } from "../src/lib/validation/kit";
import type { Kit, Question, Requirement } from "../src/lib/types";

const requirements: Requirement[] = [
  { id: "r1", text: "React", kind: "technical", priority: "must" },
  { id: "r2", text: "Mentoring", kind: "behavioural", priority: "must" },
  { id: "r3", text: "GraphQL", kind: "technical", priority: "nice" },
];

const questions: Question[] = [
  { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "React?", answer_outline: "Hooks", difficulty: 2 },
  { id: "q2", requirement_ids: ["r2"], category: "behavioural", prompt: "Mentor?", answer_outline: "STAR", difficulty: 1 },
];

function kit(): Kit {
  return {
    source: { company: "Acme", company_url: "https://example.com", role: "Engineer", location: "", jd_chars: 100, researched_at: new Date().toISOString(), pages_used: [] },
    company_brief: { summary: "Brief", what_they_do: "Things", sources: [] },
    role: { title: "Engineer", seniority: "senior", responsibilities: ["Build"], requirements },
    questions,
    flashcards: [{ id: "f1", front: "React", back: "Hooks", requirement_ids: ["r1"] }],
    schedule: buildSchedule({ role: { title: "Engineer", seniority: "senior", responsibilities: [], requirements }, questions }, 3),
    coverage: { uncovered_requirement_ids: [], passes: 2 },
  };
}

describe("coverage", () => {
  it("finds uncovered must-have requirements", () => {
    expect(checkCoverage(requirements, questions.slice(0, 1))).toEqual(["r2"]);
  });

  it("ignores uncovered nice-to-have requirements", () => {
    expect(checkCoverage(requirements, questions)).toEqual([]);
  });
});

describe("schedule", () => {
  it("uses exactly the requested number of days", () => {
    expect(buildSchedule({ role: { title: "", seniority: "", responsibilities: [], requirements }, questions }, 5).days).toHaveLength(5);
  });

  it("places must-have material into the schedule", () => {
    const schedule = buildSchedule({ role: { title: "", seniority: "", responsibilities: [], requirements }, questions }, 2);
    expect(schedule.days.flatMap((d) => d.question_ids).sort()).toEqual(["q1", "q2"]);
  });
});

describe("requirement extraction", () => {
  const jd = [
    "Senior Backend Engineer",
    "",
    "We are building a fintech platform.",
    "Required:",
    "- 5+ years of experience with Node.js",
    "- Must have designed distributed systems",
    "- Strong communication and mentoring skills",
    "Bonus: Kubernetes experience a plus",
  ].join("\n");

  it("extracts a role title instead of the whole JD", () => {
    expect(extractRoleHeuristics(jd).title).toBe("Senior Backend Engineer");
  });

  it("splits requirements into separate clauses with priorities", () => {
    const { requirements } = extractRoleHeuristics(jd);
    const texts = requirements.map((r) => r.text);
    expect(texts.some((t) => t.includes("Node.js"))).toBe(true);
    expect(texts.some((t) => t.includes("Kubernetes"))).toBe(true);
    expect(requirements.find((r) => r.text.includes("Kubernetes"))?.priority).toBe("nice");
    expect(requirements.find((r) => r.text.includes("distributed systems"))?.priority).toBe("must");
  });

  it("marks mentoring requirements as behavioural", () => {
    const { requirements } = extractRoleHeuristics(jd);
    expect(requirements.find((r) => /mentoring/i.test(r.text))?.kind).toBe("behavioural");
  });

  it("never returns an empty requirement list for a non-empty JD", () => {
    const { requirements } = extractRoleHeuristics("Platform engineer role at a healthcare company.");
    expect(requirements.length).toBeGreaterThan(0);
  });
});

describe("kit validation", () => {
  it("accepts the required Appendix A structure", () => {
    expect(validateKit(kit()).ok).toBe(true);
  });

  it("rejects schedules that reference missing questions", () => {
    const broken = kit();
    broken.schedule.days[0].question_ids = ["missing"];
    expect(validateKit(broken).ok).toBe(false);
  });
});
