import { createOpencode, type OpencodeClient, type ServerOptions } from "@opencode-ai/sdk/v2"
import { z } from "zod"

type PromptInput = Parameters<OpencodeClient["session"]["prompt"]>[0]

export type StructuredPromptInput<Schema extends z.ZodType> = Omit<PromptInput, "format" | "noReply"> & {
  schema: Schema
  retryCount?: number
}

export async function promptStructured<Schema extends z.ZodType>(
  client: OpencodeClient,
  input: StructuredPromptInput<Schema>,
): Promise<z.output<Schema>> {
  const { schema, retryCount, ...prompt } = input
  const result = await client.session.prompt(
    {
      ...prompt,
      format: {
        type: "json_schema",
        schema: z.toJSONSchema(schema),
        retryCount,
      },
    },
    { throwOnError: true },
  )

  return schema.parse(result.data.info.structured)
}

export async function workflow<Result>(
  run: (client: OpencodeClient) => Promise<Result>,
  options: ServerOptions = { port: 0 },
): Promise<Result> {
  const opencode = await createOpencode(options)
  try {
    return await run(opencode.client)
  } finally {
    opencode.server.close()
  }
}

export function text(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
}

export { z }
export type { OpencodeClient, ServerOptions }
