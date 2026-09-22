import { db, ObjectId } from "@/lib/db/mongo";
import { runPipeline } from "@/lib/pipeline/run";
import type { PipelineInput } from "@/lib/types";

/**
 * Run kit generation in the background for an already-created kit document.
 * Progress and partial results are persisted as each pipeline step completes,
 * so a client timeout, disconnect, or crash keeps whatever was produced.
 */
export async function startKitGeneration(docId: ObjectId, userId: ObjectId, input: PipelineInput): Promise<void> {
  const database = await db();
  const collection = database.collection("kits");
  const progress: string[] = [];
  try {
    const result = await runPipeline(input, async (step, fields) => {
      progress.push(step);
      await collection.updateOne(
        { _id: docId, userId },
        { $set: { ...(fields || {}), progress: [...progress], updatedAt: new Date() } },
      );
    });
    await collection.updateOne(
      { _id: docId, userId },
      { $set: { status: "ready", kit: result.kit, warnings: result.warnings, error: null, updatedAt: new Date() } },
    );
  } catch (error) {
    const coded = error as Error & { code?: string };
    await collection.updateOne(
      { _id: docId, userId },
      { $set: { status: "failed", error: { code: coded.code || "PIPELINE_FAILED", message: error instanceof Error ? error.message : "Unknown error" }, updatedAt: new Date() } },
    );
  }
}
