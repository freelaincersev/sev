/**
 * Chat model registry for the Ask panel's model picker. Metadata only — no
 * secrets — so it's safe to import from Client Components. The provider →
 * API-model + API-key mapping lives server-side in lib/retrieval/answer.ts.
 */
export type ChatProvider = "openai" | "anthropic" | "gemini";

export type ChatModelKey = "gpt-4o-mini" | "claude-sonnet" | "gemini-flash";

export type ChatModel = {
  key: ChatModelKey;
  label: string;
  provider: ChatProvider;
};

export const CHAT_MODELS: ChatModel[] = [
  { key: "gpt-4o-mini", label: "GPT-4o mini", provider: "openai" },
  { key: "claude-sonnet", label: "Claude Sonnet", provider: "anthropic" },
  { key: "gemini-flash", label: "Gemini Flash", provider: "gemini" },
];

export const DEFAULT_CHAT_MODEL_KEY: ChatModelKey = "gpt-4o-mini";

/** Resolve a (possibly untrusted) key to a known model, falling back to default. */
export function getChatModel(key: string): ChatModel {
  return (
    CHAT_MODELS.find((m) => m.key === key) ??
    CHAT_MODELS.find((m) => m.key === DEFAULT_CHAT_MODEL_KEY)!
  );
}
