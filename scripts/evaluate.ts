import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { runPipeline } from "../src/lib/pipeline/run";

type CodedError = Error & { code?: string };
type CaseInput = { id: string; jd: string; company_url: string; days: number };
type CaseResult = { id: string; status: "ok" | "failed"; kit: unknown | null; error: { code: string; message: string } | null };

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/** Run tasks with bounded concurrency, preserving input order in results. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function runCase(item: CaseInput): Promise<CaseResult> {
  try {
    const result = await runPipeline(item);
    return { id: item.id, status: "ok", kit: result.kit, error: null };
  } catch (error) {
    const coded = error as CodedError;
    return {
      id: item.id,
      status: "failed",
      kit: null,
      error: { code: coded.code || "PIPELINE_FAILED", message: error instanceof Error ? error.message : "Unknown error" },
    };
  }
}

async function main() {
  const inputPath = arg("--input");
  const outputPath = arg("--output");
  if (!inputPath || !outputPath) throw new Error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
  const cases = JSON.parse(await readFile(inputPath, "utf8")) as CaseInput[];
  // Free-tier LLM pools rate-limit aggressively; 2 workers keep total wall time
  // for 5 cases well under the 15-minute budget while avoiding 429 storms.
  const kits = await mapWithConcurrency(cases, 2, runCase);
  await writeFile(outputPath, JSON.stringify({ version: "1.0", generated_at: new Date().toISOString(), kits }, null, 2));
  const failed = kits.filter((k) => k.status === "failed");
  console.log(`evaluate: ${kits.length - failed.length}/${kits.length} cases ok -> ${outputPath}`);
  if (failed.length) for (const f of failed) console.log(`  failed: ${f.id} (${f.error?.code})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
