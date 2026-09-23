import { describe, expect, it } from "vitest";
import { computeWeakSpots } from "../src/lib/kit/weakSpots";
import { buildSchedule } from "../src/lib/pipeline/schedule";
import type { Kit, Requirement } from "../src/lib/types";

const requirements: Requirement[] = [
  { id: "r1", text: "React", kind: "technical", priority: "must" },
  { id: "r2", text: "Mentoring", kind: "behavioural", priority: "must" },
  { id: "r3", text: "GraphQL", kind: "technical", priority: "nice" },
];

function kit(): Kit {
  return {
    source: { company: "Acme", company_url: "https://example.com", role: "Engineer", location: "", jd_chars: 100, researched_at: new Date().toISOString(), pages_used: [] },
    company_brief: { summary: "Brief", what_they_do: "Things", sources: [] },
    role: { title: "Engineer", seniority: "senior", responsibilities: ["Build"], requirements },
    questions: [
      { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "React?", answer_outline: "Hooks", difficulty: 2 },
    ],
    flashcards: [
      { id: "f1", front: "React patterns", back: "Hooks", requirement_ids: ["r1"] },
      { id: "f2", front: "GraphQL basics", back: "Schema", requirement_ids: ["r3"] },
      { id: "f3", front: "System design", back: "Load balancer", requirement_ids: [] },
    ],
    schedule: buildSchedule(
      { role: { title: "Engineer", seniority: "senior", responsibilities: [], requirements }, questions: [] },
      3,
    ),
    coverage: { uncovered_requirement_ids: ["r2", "r3"], passes: 2 },
  };
}

describe("computeWeakSpots", () => {
  it("flags uncovered must-haves as bad and nice-to-haves as warn, sorted bad first", () => {
    const spots = computeWeakSpots(kit(), {});
    expect(spots.map((s) => s.id)).toEqual(["req-r2", "req-r3"]);
    expect(spots[0].level).toBe("bad");
    expect(spots[1].level).toBe("warn");
  });

  it("includes flashcards rated 1-2 and ignores confident or unseen cards", () => {
    const spots = computeWeakSpots(kit(), { f1: 1, f2: 5 });
    const cardSpots = spots.filter((s) => s.id.startsWith("card-"));
    expect(cardSpots).toHaveLength(1);
    expect(cardSpots[0].id).toBe("card-f1");
    expect(cardSpots[0].detail).toContain("1/5");
  });

  it("returns an empty list when coverage is clear and practice is confident", () => {
    const clear = { ...kit(), coverage: { uncovered_requirement_ids: [] as string[], passes: 2 } };
    expect(computeWeakSpots(clear, { f1: 4, f2: 5, f3: 3 })).toEqual([]);
  });
});
