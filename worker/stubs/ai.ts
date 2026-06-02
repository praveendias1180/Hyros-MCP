// Stub for the Vercel AI SDK ("ai" package).
//
// The `agents` runtime lazy-imports `ai` only inside `getAITools()` to convert
// tool schemas into the AI SDK format. This Worker uses the low-level MCP
// `Server` directly and never calls that path, so we alias `ai` to this stub
// to avoid bundling the (large) real package. If the path is ever hit, the
// passed-through schema keeps the shape callers expect.
export function jsonSchema(schema: unknown): Record<string | symbol, unknown> {
  return { jsonSchema: schema, [Symbol.for('vercel.ai.schema')]: true };
}
