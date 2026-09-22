import { z } from "zod";

const req = z.object({
  id: z.string().min(1),
  text: z.string(),
  kind: z.enum(["technical", "behavioural", "domain"]),
  priority: z.enum(["must", "nice"]),
});

const question = z.object({
  id: z.string().min(1),
  requirement_ids: z.array(z.string()),
  category: z.enum(["technical", "behavioural", "system-design", "company-fit"]),
  prompt: z.string(),
  answer_outline: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  meta: z.any().optional(),
});

const flashcard = z.object({
  id: z.string().min(1),
  front: z.string(),
  back: z.string(),
  requirement_ids: z.array(z.string()),
  meta: z.any().optional(),
});

export const kitSchema = z.object({
  source: z.object({
    company: z.string(),
    company_url: z.string(),
    role: z.string(),
    location: z.string(),
    jd_chars: z.number().int().nonnegative(),
    researched_at: z.string(),
    pages_used: z.array(z.string()),
  }),
  company_brief: z.object({
    summary: z.string(),
    what_they_do: z.string(),
    sources: z.array(z.string()),
    meta: z.any().optional(),
  }),
  role: z.object({
    title: z.string(),
    seniority: z.string(),
    responsibilities: z.array(z.string()),
    requirements: z.array(req),
  }),
  questions: z.array(question),
  flashcards: z.array(flashcard),
  schedule: z.object({
    days_available: z.number().int().positive(),
    days: z.array(z.object({ day: z.number().int().positive(), focus: z.string(), question_ids: z.array(z.string()), minutes: z.number().int().nonnegative() })),
  }),
  coverage: z.object({ uncovered_requirement_ids: z.array(z.string()), passes: z.number().int().positive() }),
  research_notes: z.array(z.string()).optional(),
});

export function validateKit(value: unknown) {
  const parsed = kitSchema.safeParse(value);
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };
  const kit = parsed.data;
  const questionIds = new Set(kit.questions.map((q) => q.id));
  const badScheduleId = kit.schedule.days.flatMap((d) => d.question_ids).find((id) => !questionIds.has(id));
  if (badScheduleId) return { ok: false as const, error: `schedule references missing question ${badScheduleId}` };
  if (kit.schedule.days.length !== kit.schedule.days_available) return { ok: false as const, error: "schedule day count does not match days_available" };
  return { ok: true as const, kit };
}
