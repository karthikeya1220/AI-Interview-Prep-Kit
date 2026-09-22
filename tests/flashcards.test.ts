import { describe, expect, it, vi } from "vitest";
import { generateFlashcardsStep } from "../src/lib/pipeline/run";
import type { Requirement } from "../src/lib/types";

const requirements: Requirement[] = [
  { id: "r1", text: "5+ years with React", kind: "technical", priority: "must" },
  { id: "r2", text: "Mentor juniors", kind: "behavioural", priority: "nice" },
];

vi.mock("../src/lib/llm/openrouter", () => ({
  jsonCompletion: vi.fn(),
}));

async function runWith(modelFlashcards: unknown[]) {
  const { jsonCompletion } = await import("../src/lib/llm/openrouter");
  vi.mocked(jsonCompletion).mockResolvedValueOnce({ flashcards: modelFlashcards } as never);
  return generateFlashcardsStep(requirements);
}

describe("generateFlashcardsStep", () => {
  it("drops flashcards with missing or empty required fields instead of failing the kit", async () => {
    const cards = await runWith([
      { front: "Good card", back: "Good answer", requirement_ids: ["r1"] },
      { back: "front missing" },
      { front: "   ", back: "blank front" },
      { front: "no back" },
      null,
      undefined,
    ]);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ id: "f1", front: "Good card", back: "Good answer" });
  });

  it("falls back to deterministic cards when the model returns nothing usable", async () => {
    const cards = await runWith([{ back: "orphan" }, { front: "", back: "" }]);
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.front.trim()).toBeTruthy();
      expect(card.back.trim()).toBeTruthy();
      expect(card.id).toMatch(/^f\d+$/);
    }
  });
});
