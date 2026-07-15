import { realpath, stat } from "node:fs/promises"
import path from "node:path"
import { inspect } from "node:util"
import { pathToFileURL } from "node:url"
import { tool } from "@opencode-ai/plugin"

function isWithin(root: string, target: string) {
  const relative = path.relative(root, target)
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

export default tool({
  description: "Run a TypeScript workflow from the project's .opencode/workflows directory. Used exclusively to run workflows generated with the guidance of the `workflows` skill",
  args: {
    path: tool.schema.string().describe("Workflow path relative to .opencode/workflows"),
  },
  async execute(args, context) {
    if (path.isAbsolute(args.path) || path.extname(args.path) !== ".ts") {
      throw new Error("Workflow path must be a relative .ts file")
    }

    const root = path.resolve(context.directory, ".opencode/workflows")
    const script = path.resolve(root, args.path)
    if (!isWithin(root, script)) {
      throw new Error("Workflow path must stay within .opencode/workflows")
    }

    const [resolvedRoot, resolvedScript] = await Promise.all([realpath(root), realpath(script)])
    if (!isWithin(resolvedRoot, resolvedScript)) {
      throw new Error("Workflow symlinks must stay within .opencode/workflows")
    }
    if (!(await stat(resolvedScript)).isFile()) {
      throw new Error("Workflow path must reference a file")
    }

    await context.ask({
      permission: "run-workflow",
      patterns: [resolvedScript],
      always: [resolvedScript],
      metadata: { script: resolvedScript },
    })

    const url = pathToFileURL(resolvedScript)
    url.searchParams.set("run", crypto.randomUUID())

    const module = await import(url.href)
    const result = typeof module.default === "function" ? await module.default() : undefined

    return result === undefined ? "Workflow completed successfully." : inspect(result, { depth: 8 })
  },
})
