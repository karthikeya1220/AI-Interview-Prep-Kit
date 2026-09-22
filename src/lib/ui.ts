import type { QuestionCategory } from "@/lib/types";

export const categoryLabel: Record<QuestionCategory, string> = {
  technical: "Technical",
  behavioural: "Behavioural",
  "system-design": "System design",
  "company-fit": "Company fit",
};

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || url;
  }
}

export function difficultyDots(level: 1 | 2 | 3): string {
  return "●".repeat(level) + "○".repeat(3 - level);
}
