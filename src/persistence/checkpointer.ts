import { BaseCheckpointSaver, MemorySaver } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

let checkpointerInstance: BaseCheckpointSaver | null = null;

export async function getCheckpointer(): Promise<BaseCheckpointSaver> {
  if (checkpointerInstance) {
    return checkpointerInstance;
  }

  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl && !process.env.USE_MEMORY_CHECKPOINTER) {
    try {
      const postgresSaver = PostgresSaver.fromConnString(dbUrl);
      await postgresSaver.setup();
      checkpointerInstance = postgresSaver;
      return checkpointerInstance;
    } catch (err) {
      console.warn(
        "[Checkpointer] Failed to initialize PostgresSaver, falling back to MemorySaver:",
        err instanceof Error ? err.message : err
      );
    }
  }

  checkpointerInstance = new MemorySaver();
  return checkpointerInstance;
}
