import type { Kit, Question } from "@/lib/types";

function scoreQuestion(q: Question, mustIds: Set<string>) {
  const coversMust = q.requirement_ids.some((id) => mustIds.has(id)) ? 10 : 0;
  return coversMust + q.difficulty;
}

export function buildSchedule(kit: Pick<Kit, "role" | "questions">, requestedDays: number) {
  const daysAvailable = Math.max(1, Math.min(60, Math.floor(requestedDays || 1)));
  const mustIds = new Set(kit.role.requirements.filter((r) => r.priority === "must").map((r) => r.id));
  const sorted = [...kit.questions].sort((a, b) => scoreQuestion(b, mustIds) - scoreQuestion(a, mustIds));
  const days = Array.from({ length: daysAvailable }, (_, i) => ({ day: i + 1, focus: "Review and practice", question_ids: [] as string[], minutes: 0 }));

  sorted.forEach((q, index) => {
    const day = days[index % daysAvailable];
    day.question_ids.push(q.id);
    day.minutes += 20 + q.difficulty * 10;
  });

  const requirementText = new Map(kit.role.requirements.map((r) => [r.id, r.text]));
  for (const day of days) {
    const firstQuestion = sorted.find((q) => day.question_ids.includes(q.id));
    const firstReq = firstQuestion?.requirement_ids[0];
    day.focus = firstReq ? requirementText.get(firstReq) || "Interview practice" : "Light review and company research";
  }

  return { days_available: daysAvailable, days };
}
