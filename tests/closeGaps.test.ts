import { describe, expect, it } from "vitest";
import { checkCoverage } from "../src/lib/pipeline/coverage";
import { categoryForRequirement, closeMustHaveGaps, gapQuestionFor } from "../src/lib/pipeline/closeGaps";
import type { Question, Requirement } from "../src/lib/types";

const requirements: Requirement[] = [
  { id: "r1", text: "React", kind: "technical", priority: "must" },
  { id: "r2", text: "Mentoring juniors", kind: "behavioural", priority: "must" },
  { id: "r3", text: "Fintech domain", kind: "domain", priority: "must" },
  { id: "r4", text: "GraphQL", kind: "technical", priority: "nice" },
];

describe("closeMustHaveGaps", () => {
  it("adds a question for every still-uncovered must-have regardless of kind", () => {
    const questions: Question[] = [
      { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "React?", answer_outline: "", difficulty: 2 },
    ];
    const closed = closeMustHaveGaps(requirements, questions);
    const merged = questions.concat(closed);
    expect(checkCoverage(requirements, merged)).toEqual([]);
    expect(closed.map((q) => q.requirement_ids[0]).sort()).toEqual(["r2", "r3"]);
  });

  it("is a no-op when all must-haves are already covered", () => {
    const questions: Question[] = [
      { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "a", answer_outline: "", difficulty: 2 },
      { id: "q2", requirement_ids: ["r2"], category: "behavioural", prompt: "b", answer_outline: "", difficulty: 2 },
      { id: "q3", requirement_ids: ["r3"], category: "company-fit", prompt: "c", answer_outline: "", difficulty: 2 },
    ];
    expect(closeMustHaveGaps(requirements, questions)).toEqual([]);
  });

  it("never collides with existing question ids", () => {
    const questions: Question[] = [
      { id: "q-cov-r2", requirement_ids: ["r1"], category: "technical", prompt: "a", answer_outline: "", difficulty: 2 },
    ];
    const closed = closeMustHaveGaps(requirements, questions);
    const ids = new Set(questions.map((q) => q.id));
    for (const q of closed) {
      expect(ids.has(q.id)).toBe(false);
      ids.add(q.id);
    }
    expect(checkCoverage(requirements, questions.concat(closed))).toEqual([]);
  });
});

describe("categoryForRequirement", () => {
  it("maps kinds to coverable categories", () => {
    expect(categoryForRequirement(requirements[0])).toBe("technical");
    expect(categoryForRequirement(requirements[1])).toBe("behavioural");
    expect(categoryForRequirement(requirements[2])).toBe("company-fit");
  });

  it("gap questions always reference the requirement id", () => {
    for (const r of requirements) {
      const q = gapQuestionFor(r, "qx");
      expect(q.requirement_ids).toEqual([r.id]);
      expect(q.category).toBe(categoryForRequirement(r));
    }
  });
});
