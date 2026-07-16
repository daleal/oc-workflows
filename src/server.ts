import { fileURLToPath } from 'node:url';
import type { PluginModule } from '@opencode-ai/plugin';
import runWorkflow from './run-workflow.ts';

const skillRoot = fileURLToPath(new URL('../skills', import.meta.url));

type ConfigWithSkills = {
  skills?: {
    paths?: string[];
    urls?: string[];
  };
};

const plugin: PluginModule & { id: string } = {
  id: 'daleal.workflows',
  server: async ({ client }) => {
    return {
      config(config) {
        const configured = config as typeof config & ConfigWithSkills;
        const paths = configured.skills?.paths ?? [];
        configured.skills = {
          ...configured.skills,
          paths: paths.includes(skillRoot) ? paths : [...paths, skillRoot],
        };
        configured.agent = {
          ...configured.agent,
          workflow: {
            mode: 'subagent',
            hidden: true,
            description: 'Runs a generated TypeScript workflow through the run-workflow tool',
            prompt:
              'Immediately call run-workflow exactly once with the workflow path from the request. Do not inspect files, plan, explain, or perform any other work. Immediately return the tool result exactly as-is.',
            permission: {
              '*': 'deny',
              'run-workflow': 'allow',
            } as Record<string, 'allow' | 'deny'>,
          },
        };
        return Promise.resolve();
      },
      tool: {
        'run-workflow': runWorkflow(client),
      },
    };
  },
};

export default plugin;
