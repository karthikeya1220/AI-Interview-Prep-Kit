import type { Kit } from "@/lib/types";

export type WeakSpot = {
  id: string;
  level: "bad" | "warn";
  title: string;
  detail: string;
};

/**
 * Creative feature: combines the deterministic coverage check with practice
 * confidence records into one prioritised list of what to work on next.
 * Bad = uncovered must-have or a card rated 1; warn = uncovered nice-to-have
 * or a card rated 2. Cards rated 3+ and covered requirements are not weak.
 */
export function computeWeakSpots(kit: Kit, records: Record<string, number>): WeakSpot[] {
  const spots: WeakSpot[] = [];
  const byId = new Map(kit.role.requirements.map((r) => [r.id, r]));
  for (const id of kit.coverage.uncovered_requirement_ids) {
    const requirement = byId.get(id);
    if (!requirement) continue;
    spots.push({
      id: `req-${id}`,
      level: requirement.priority === "must" ? "bad" : "warn",
      title: requirement.text,
      detail: requirement.priority === "must" ? "Must-have requirement with no question" : "Nice-to-have requirement with no question",
    });
  }
  for (const card of kit.flashcards) {
    const confidence = records[card.id];
    if (confidence === undefined || confidence > 2) continue;
    spots.push({
      id: `card-${card.id}`,
      level: confidence === 1 ? "bad" : "warn",
      title: card.front,
      detail: `You rated this ${confidence}/5 in practice`,
    });
  }
  const rank = { bad: 0, warn: 1 } as const;
  return spots.sort((a, b) => rank[a.level] - rank[b.level]);
}
