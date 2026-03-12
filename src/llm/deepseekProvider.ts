import { extractJsonObject } from "./jsonExtractor";
import type { LLMProvider } from "./types";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat";

export class DeepSeekProvider implements LLMProvider {
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor({
    apiKey = process.env.DEEPSEEK_API_KEY,
    model = DEFAULT_MODEL,
    baseUrl = DEFAULT_BASE_URL,
    timeoutMs = 30000
  }: {
    apiKey?: string;
    model?: string;
    baseUrl?: string;
    timeoutMs?: number;
  } = {}) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  get modelName(): string {
    return this.model;
  }

  private ensureApiKey(): string {
    if (!this.apiKey) {
      throw new Error("Missing DEEPSEEK_API_KEY. In fish, run: set -x DEEPSEEK_API_KEY 'your_key'");
    }
    return this.apiKey;
  }

  async generateDecision({
    systemPrompt,
    userPrompt,
    temperature = 0.7
  }: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
  }): Promise<unknown> {
    const apiKey = this.ensureApiKey();
    const request = async (forceJsonObject: boolean): Promise<unknown> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: this.model,
            temperature,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            ...(forceJsonObject ? { response_format: { type: "json_object" } } : {})
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`DeepSeek API error ${response.status}: ${body}`);
        }

        const data = (await response.json()) as {
          choices?: Array<{
            message?: {
              content?: string | Array<{ type?: string; text?: string }>;
            };
          }>;
        };

        const contentRaw = data.choices?.[0]?.message?.content;
        const content = Array.isArray(contentRaw)
          ? contentRaw
              .map((part) => (typeof part?.text === "string" ? part.text : ""))
              .join("")
              .trim()
          : typeof contentRaw === "string"
            ? contentRaw
            : "";

        if (!content) {
          throw new Error("DeepSeek response missing message content.");
        }

        return extractJsonObject(content);
      } finally {
        clearTimeout(timer);
      }
    };

    try {
      return await request(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("response_format")) {
        throw error;
      }
      return request(false);
    }
  }
}
