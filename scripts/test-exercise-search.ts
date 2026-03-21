/**
 * Manual test script for the LLM exercise search agent.
 *
 * Usage:
 *   npm run ai:test -- "bench press"
 *   npm run ai:test -- "tlaky s jednoručkou"
 *   npm run ai:test -- --quiet "legpress"
 *   npm run ai:test -- --user <userId> "legpress"
 *
 * Flags:
 *   --quiet       Only print the final suggestion (skip step details)
 *   --user <id>   Test with a specific userId (includes private exercises)
 *
 * Requires:
 *   - AI_GATEWAY_API_KEY in .env
 *   - DATABASE_URL in .env (DB must be running)
 */

import "dotenv/config";
import {
  type AgentError,
  type AgentStepDebugInfo,
  type ExerciseSearchDebugResult,
  searchExerciseWithAI,
} from "../lib/exercise-agent";

const SEPARATOR = "─".repeat(60);

function parseArgs(): { query: string; quiet: boolean; userId?: string } {
  const args = process.argv.slice(2);
  const quiet = args.includes("--quiet");
  const filtered = args.filter((a) => a !== "--quiet");

  // Extract --user flag
  let userId: string | undefined;
  const userIdx = filtered.indexOf("--user");
  if (userIdx !== -1) {
    userId = filtered[userIdx + 1];
    if (!userId) {
      console.error("--user requires a userId argument");
      process.exit(1);
    }
    filtered.splice(userIdx, 2);
  }

  const query = filtered.join(" ");

  if (!query) {
    console.error(
      "Usage: npm run ai:test -- [--quiet] [--user <userId>] <query>",
    );
    console.error('Example: npm run ai:test -- "bench press"');
    process.exit(1);
  }

  return { query, quiet, userId };
}

function printStep(step: AgentStepDebugInfo) {
  console.log(`\n${SEPARATOR}`);
  console.log(`Step ${step.stepNumber}  (${step.finishReason})`);
  console.log(SEPARATOR);

  for (const tc of step.toolCalls) {
    console.log(`  Tool call: ${tc.toolName}`);
    console.log(`  Input:     ${JSON.stringify(tc.input)}`);
  }

  for (const tr of step.toolResults) {
    const output = JSON.stringify(tr.output, null, 2);
    console.log(`  Tool result: ${tr.toolName}`);
    console.log(`  Output (${output.length} chars):`);
    for (const line of output.split("\n")) {
      console.log(`    ${line}`);
    }
  }

  if (step.text) {
    console.log(
      `  Text: ${step.text.slice(0, 200)}${step.text.length > 200 ? "…" : ""}`,
    );
  }

  console.log(
    `  Tokens: ${step.usage.inputTokens} in / ${step.usage.outputTokens} out`,
  );
}

function printStats(
  debug: Pick<ExerciseSearchDebugResult, "steps" | "totalUsage">,
  elapsedMs: number,
) {
  console.log(`\n${SEPARATOR}`);
  console.log("STATS");
  console.log(SEPARATOR);
  console.log(`  Steps:    ${debug.steps.length}`);
  console.log(
    `  Tokens:   ${debug.totalUsage.inputTokens} in / ${debug.totalUsage.outputTokens} out (${debug.totalUsage.totalTokens} total)`,
  );
  console.log(`  Duration: ${elapsedMs}ms`);
}

async function main() {
  const { query, quiet, userId } = parseArgs();

  console.log(`\nQuery: "${query}"`);
  if (userId) console.log(`User:  ${userId}`);
  console.log(SEPARATOR);

  const startMs = performance.now();

  try {
    const result = (await searchExerciseWithAI(query, userId, {
      verbose: true,
    })) as ExerciseSearchDebugResult;
    const elapsedMs = Math.round(performance.now() - startMs);

    if (!quiet) {
      for (const step of result.steps) {
        printStep(step);
      }
    }

    console.log(`\n${SEPARATOR}`);
    console.log("SUGGESTION");
    console.log(SEPARATOR);
    console.log(JSON.stringify(result.suggestion, null, 2));

    printStats(result, elapsedMs);
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - startMs);
    const err = error as AgentError;

    console.error("\nError:", err.message ?? error);
    if (err.stack) {
      console.error(err.stack);
    }

    // Print step diagnostics from the error
    const debugResult =
      err.debugResult ?? (err.cause as AgentError)?.debugResult;
    if (debugResult) {
      for (const step of debugResult.steps) {
        printStep(step);
      }
      printStats(debugResult, elapsedMs);
    } else {
      console.log(`  Duration: ${elapsedMs}ms`);
    }

    process.exit(1);
  }
}

main();
