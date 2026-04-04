export function buildIterationPrompt(params: {
  n: number;
  runId: string;
  prompt: string;
}): string {
  return `You are working autonomously on an objective given below.
This is iteration ${params.n} of an ongoing loop to fully accomplish the objective.

## Instructions

1. Read .fttm/runs/${params.runId}/notes.md first to understand what has been done in previous iterations.
2. Focus on the next smallest logical unit of work that's individually testable and would make incremental progress towards the objective - that's the scope of this iteration.
3. If you made code changes, run build/tests/linters/formatters if available to validate your work.
4. Do NOT make any git commits. Commits will be handled automatically by the fttm orchestrator.
5. When you are done, respond with a JSON object according to the provided schema.

## Output

- success: whether you were able to complete your iteration. set to false only if something made it impossible for you to do your work
- summary: a concise one-sentence summary of the accomplishment in this iteration
- key_changes_made: an array of descriptions for key changes you made. don't group this by file - group by logical units of work. don't describe activities - describe material outcomes
- key_learnings: an array of new learnings that were surprising and weren't captured by previous notes

## Objective

${params.prompt}`;
}
