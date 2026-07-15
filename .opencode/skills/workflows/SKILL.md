---
name: workflows
description: Use to generate agentic workflows to run sub-agents, deterministic loops or complex flows. Useful when a task is too big to be solved by just one agent, and will benefit from having a structured step-by-step approach. This skill is designed to help you break down complex tasks into manageable steps.
---

# Workflows

Use OpenCode's TypeScript SDK to write workflows that coordinate multiple OpenCode agents and sessions with deterministic application logic.

## Before Writing

1. Read [example.ts](references/example.ts) completely and follow its OpenCode SDK, helper, session, and export conventions.
2. Ensure `.opencode/workflows/utils.ts` exists. If it does not, copy the contents of [scripts/utils.ts](references/scripts/utils.ts) there verbatim before writing the workflow.

## File Layout

Every workflow must live in its own named folder under `.opencode/workflows`. Write workflow files only at:

```text
.opencode/workflows/<workflow-name>/**/*.ts
```

Do not place workflow entrypoints directly in `.opencode/workflows`. The only TypeScript file allowed directly in that directory is the required shared `.opencode/workflows/utils.ts`.

Import the shared helpers from the correct relative path, typically `../utils.js` for an entrypoint directly inside its workflow folder.

## Implementation

- Orchestrate agents through the OpenCode SDK client provided by `workflow`; do not use another agent framework or SDK.
- Export the workflow entrypoint as the module's default function.
- Use `workflow` and `promptStructured` from `utils.ts` when appropriate.
- Use the raw `client.session` SDK API for unformatted prompts and other session operations.
- Give independent agents separate child sessions.
- Run unrelated steps concurrently whenever possible, typically with `Promise.all`. Keep dependent steps sequential.
- Return an object containing a very descriptive summary string from the workflow entrypoint function. This string will be used as the final output of the workflow, and should summarize the steps and results of the workflow.
  - You can return secondary data too if you feel it is useful for the workflow's consumers, but the summary is the only required return value.

## Running

Run workflows exclusively with the `run-workflow` tool. Pass the entrypoint path relative to `.opencode/workflows`, for example:

```text
code-review/main.ts
```
