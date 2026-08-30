/** Extracts the plain text an investigation tool returned (its `{content:[{type:'text',text}]}` shape). */
export function toolResultText(result: unknown): string {
  if (result && typeof result === "object" && "content" in result) {
    const content = (result as { content: { type: string; text?: string }[] }).content;
    return content.map((c) => c.text ?? "").join("\n");
  }
  return "";
}
