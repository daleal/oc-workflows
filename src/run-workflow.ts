import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspect } from 'node:util';
import { tool, type PluginInput } from '@opencode-ai/plugin';
import { Effect } from 'effect';

type WorkflowProgress = {
  name?: string;
  status: 'running' | 'completed';
  phase: string;
  [key: string]: unknown;
};

const isWithin = (root: string, target: string) => {
  const relative = path.relative(root, target);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};

const runWorkflow = (client: PluginInput['client']) =>
  tool({
    description:
      "Run a TypeScript workflow from the project's .opencode/workflows/runtime directory. Used exclusively to run workflows generated with the guidance of the `workflows` skill",
    args: {
      path: tool.schema.string().describe('Workflow path relative to .opencode/workflows/runtime'),
    },
    async execute(args, context) {
      if (path.isAbsolute(args.path) || path.extname(args.path) !== '.ts') {
        throw new Error('Workflow path must be a relative .ts file');
      }

      const root = path.resolve(context.directory, '.opencode/workflows/runtime');
      const script = path.resolve(root, args.path);
      if (!isWithin(root, script)) {
        throw new Error('Workflow path must stay within .opencode/workflows/runtime');
      }

      const [resolvedRoot, resolvedScript] = await Promise.all([realpath(root), realpath(script)]);
      if (!isWithin(resolvedRoot, resolvedScript)) {
        throw new Error('Workflow symlinks must stay within .opencode/workflows/runtime');
      }
      if (!(await stat(resolvedScript)).isFile()) {
        throw new Error('Workflow path must reference a file');
      }

      await context.ask({
        permission: 'run-workflow',
        patterns: [resolvedScript],
        always: [resolvedScript],
        metadata: { script: resolvedScript },
      });

      const url = pathToFileURL(resolvedScript);
      url.searchParams.set('run', crypto.randomUUID());

      let updates = Promise.resolve();
      let recordedPhase: string | undefined;
      const update = async (next: WorkflowProgress & { path: string }) => {
        const metadata = (
          context.metadata as unknown as (input: Parameters<typeof context.metadata>[0]) => unknown
        )({
          title: next.name ? `${next.name} · ${next.phase}` : next.phase,
          metadata: { workflow: next },
        });
        if (Effect.isEffect(metadata)) {
          await Effect.runPromise(metadata as Effect.Effect<void, unknown, never>);
        }
        if (recordedPhase === next.phase) return;
        await client.session.prompt({
          path: { id: context.sessionID },
          body: {
            agent: context.agent,
            noReply: true,
            parts: [{ type: 'text', text: `↳ ${next.phase}`, ignored: true }],
          },
          throwOnError: true,
        });
        recordedPhase = next.phase;
      };
      const publish = (next: WorkflowProgress & { path: string }) => {
        updates = updates
          .catch(() => {})
          .then(() => update(next))
          .catch(() => {});
      };

      let progress: WorkflowProgress & { path: string } = {
        version: 1,
        status: 'running',
        phase: 'Loading workflow',
        path: args.path,
        startedAt: Date.now(),
        completed: 0,
        total: 0,
        tasks: [],
      };
      publish(progress);
      try {
        const module = await import(url.href);
        const result =
          typeof module.default === 'function'
            ? await module.default({
                signal: context.abort,
                report(next: WorkflowProgress) {
                  progress = { ...next, path: args.path };
                  publish(progress);
                },
              })
            : undefined;

        progress = { ...progress, status: 'completed' };
        await updates;
        return {
          title: `${progress.name ?? args.path} · ${progress.phase}`,
          output:
            result === undefined
              ? 'Workflow completed successfully.'
              : inspect(result, { depth: 8 }),
          metadata: { workflow: progress },
        };
      } finally {
        await updates.catch(() => {});
      }
    },
  });

export default runWorkflow;
