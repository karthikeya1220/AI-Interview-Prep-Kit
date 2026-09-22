import { requireUserId } from "@/lib/auth/session";
import { errorResponse, json } from "@/lib/api/respond";
import { db, ObjectId } from "@/lib/db/mongo";
import { companyBriefStep, ensureCoverageStep, generateFlashcardsStep, generateQuestionsStep, researchContext } from "@/lib/pipeline/run";
import { researchCompany } from "@/lib/retrieval/company";
import { buildSchedule } from "@/lib/pipeline/schedule";
import { validateKit } from "@/lib/validation/kit";
import type { Question } from "@/lib/types";

type Context = { params: Promise<{ id: string }> };

const QUESTION_CATEGORIES = ["technical", "behavioural", "system-design", "company-fit"] as const;

function isValidObjectId(value: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(value);
}

/** Replace a generated item's id if it collides with a kept item, preserving uniqueness. */
function withUniqueId(item: { id: string }, taken: Set<string>): string {
  if (!taken.has(item.id)) return item.id;
  let counter = 1;
  while (taken.has(`${item.id}-r${counter}`)) counter++;
  return `${item.id}-r${counter}`;
}

export async function POST(request: Request, context: Context) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params;
    if (!isValidObjectId(id)) return json({ error: { message: "Kit not found." } }, 404);
    const { section, category } = await request.json();
    const database = await db();
    const doc = await database.collection("kits").findOne({ _id: new ObjectId(id), userId });
    if (!doc) return json({ error: { message: "Kit not found." } }, 404);
    const kit = doc.kit;
    const input = doc.input || { jd: "", company_url: kit.source?.company_url || "", days: kit.schedule?.days_available || 1 };
    const requirements = kit.role.requirements;

    if (section === "company_brief") {
      const { brief, research } = await companyBriefStep(input.company_url);
      kit.company_brief = { summary: brief.summary, what_they_do: brief.what_they_do, sources: research.pages.map((p) => p.url), meta: { origin: "generated" } };
      kit.source.pages_used = research.pages.map((p) => p.url);
      kit.source.researched_at = new Date().toISOString();
      kit.research_notes = research.warnings;
    }

    if (section === "questions" && QUESTION_CATEGORIES.includes(category)) {
      const existingQuestions = (kit.questions || []) as Question[];
      const kept = existingQuestions.filter((q) => q.category !== category || q.meta?.edited || q.meta?.pinned || q.meta?.origin === "user");
      // Company-fit needs live culture/hiring pages; other categories mainly need the brief.
      let context = [kit.company_brief?.summary, kit.company_brief?.what_they_do].filter(Boolean).join("\n\n");
      if (category === "company-fit") {
        try {
          const research = await researchCompany(input.company_url);
          context = researchContext(research.pages, 8000) || context;
        } catch (error) {
          console.warn("company-fit re-research failed, using stored brief", error);
        }
      }
      const fresh = await generateQuestionsStep(requirements, kit.source.company, context, [category], kept.length);
      const taken = new Set<string>(kept.map((q) => q.id));
      const merged = kept.concat(fresh.map((q) => ({ ...q, id: withUniqueId(q, taken) })));
      const { questions, uncovered } = await ensureCoverageStep(requirements, merged);
      kit.questions = questions;
      kit.coverage = { uncovered_requirement_ids: uncovered, passes: uncovered.length ? 2 : kit.coverage?.passes || 1 };
      // The schedule references question ids, so it must be rebuilt whenever questions change.
      kit.schedule = buildSchedule({ role: kit.role, questions: kit.questions }, input.days);
    }

    if (section === "flashcards") {
      kit.flashcards = await generateFlashcardsStep(requirements);
    }

    if (section === "schedule") {
      kit.schedule = buildSchedule({ role: kit.role, questions: kit.questions }, input.days);
    }

    const valid = validateKit(kit);
    if (!valid.ok) return json({ error: { message: valid.error } }, 500);
    await database.collection("kits").updateOne({ _id: new ObjectId(id), userId }, { $set: { kit: valid.kit, updatedAt: new Date() } });
    return json({ kit: valid.kit });
  } catch (error) {
    return errorResponse(error);
  }
}
