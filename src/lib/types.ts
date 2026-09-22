export type RequirementKind = "technical" | "behavioural" | "domain";
export type RequirementPriority = "must" | "nice";
export type QuestionCategory = "technical" | "behavioural" | "system-design" | "company-fit";

export type ItemMeta = {
  origin?: "generated" | "user";
  edited?: boolean;
  pinned?: boolean;
};

export type Requirement = {
  id: string;
  text: string;
  kind: RequirementKind;
  priority: RequirementPriority;
};

export type Question = {
  id: string;
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  meta?: ItemMeta;
};

export type Flashcard = {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  meta?: ItemMeta;
};

export type Kit = {
  source: {
    company: string;
    company_url: string;
    role: string;
    location: string;
    jd_chars: number;
    researched_at: string;
    pages_used: string[];
  };
  company_brief: {
    summary: string;
    what_they_do: string;
    sources: string[];
    meta?: ItemMeta;
  };
  role: {
    title: string;
    seniority: string;
    responsibilities: string[];
    requirements: Requirement[];
  };
  questions: Question[];
  flashcards: Flashcard[];
  schedule: {
    days_available: number;
    days: Array<{ day: number; focus: string; question_ids: string[]; minutes: number }>;
  };
  coverage: { uncovered_requirement_ids: string[]; passes: number };
  research_notes?: string[];
};

export type PipelineInput = { id?: string; jd: string; company_url: string; days: number };
export type PipelineResult = { kit: Kit; warnings: string[] };

/** Pipeline step names persisted as progress; shared by server and UI. */
export const PIPELINE_STEPS = ["extract requirements", "research company", "company brief", "questions", "coverage check", "flashcards", "schedule"] as const;

export type KitDocStatus = "generating" | "ready" | "failed";

/** Partial kit pieces persisted after each step; shown if generation fails. */
export type PartialKit = {
  role?: Kit["role"] | null;
  source?: Kit["source"] | null;
  company_brief?: Kit["company_brief"] | null;
  questions?: Question[] | null;
  coverage?: Kit["coverage"] | null;
  flashcards?: Flashcard[] | null;
  schedule?: Kit["schedule"] | null;
  research_notes?: string[] | null;
};
