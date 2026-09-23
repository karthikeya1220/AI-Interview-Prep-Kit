import type { Question, QuestionCategory, Requirement } from "@/lib/types";

/** Map a requirement kind to the category that should cover it in a gap-closing question. */
export function categoryForRequirement(r: Requirement): QuestionCategory {
  if (r.kind === "behavioural") return "behavioural";
  if (r.kind === "domain") return "company-fit";
  return "technical";
}

/** Deterministic question for one requirement — never filtered by kind, so any must-have can be closed. */
export function gapQuestionFor(r: Requirement, id: string): Question {
  const category = categoryForRequirement(r);
  const prompt =
    category === "behavioural"
      ? `Tell me about a time you demonstrated: ${r.text}`
      : category === "company-fit"
        ? `How does this role's expectation of "${r.text}" fit the company's way of working?`
        : `How would you apply ${r.text} in this role?`;
  return {
    id,
    requirement_ids: [r.id],
    category,
    prompt,
    answer_outline: "Explain the situation, trade-offs, concrete actions, and measurable outcome.",
    difficulty: r.priority === "must" ? 2 : 1,
    meta: { origin: "generated" },
  };
}

/**
 * Final deterministic sweep: for every still-uncovered must-have, add one question
 * that references its id (any kind → correct category). Guarantees Section 4's
 * "never ship with uncovered must-haves" regardless of model output.
 */
export function closeMustHaveGaps(requirements: Requirement[], questions: Question[]): Question[] {
  const covered = new Set(questions.flatMap((q) => q.requirement_ids));
  const taken = new Set(questions.map((q) => q.id));
  const additions: Question[] = [];
  for (const r of requirements) {
    if (r.priority !== "must" || covered.has(r.id)) continue;
    let id = `q-cov-${r.id}`;
    while (taken.has(id)) id = `${id}-x`;
    taken.add(id);
    covered.add(r.id);
    additions.push(gapQuestionFor(r, id));
  }
  return additions;
}
