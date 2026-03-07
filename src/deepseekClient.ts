import type { ActionHints, AgentState, ArtDirection, OpponentSnapshot } from "./types";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat";

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue with fallback extraction.
  }

  const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    return JSON.parse(fenced[1]);
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }

  throw new Error("LLM response does not contain valid JSON object.");
}

export class DeepSeekClient {
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

export function buildAgentSystemPrompt(agent: AgentState, artDirection: ArtDirection, personalMyth: string): string {
  return [
    "你是像素大战中的AI代理。",
    `你的ID: ${agent.id}`,
    `你的名称: ${agent.name}`,
    `你的身份DNA: ${JSON.stringify(agent.identity_dna)}`,
    ...(agent.persona ? [`兼容标签(仅供参考, 不主导行为): ${agent.persona}`] : []),
    `你的目标权重: ${JSON.stringify(agent.goal_weights)}`,
    `共享神话艺术方向: ${JSON.stringify(artDirection)}`,
    `你对这幅画的个人解读: ${personalMyth}`,
    "硬性规则:",
    "1) 你只能输出一个JSON对象。",
    "2) 不能输出Markdown、解释或代码块。",
    "3) 需要遵守能量、冷却、条约、坐标边界。",
    "4) 背约时必须在mood_change_reason说明。",
    "5) 发言短促、有角色感。",
    "6) 顶层必须包含: agent_id, round, intent, public_message, private_messages, treaty_proposals, actions, emotion_delta, mood_change_reason。",
    "7) action只能是 wait|paint|fortify|invade|burst。",
    "8) 若给出valid_action_hints，优先使用候选坐标，不要总是重复同一点。",
    "9) 你是长期数字分身，要保持价值观与说话风格稳定，不要每回合变人格。",
    "10) 行动节奏由身份DNA与局势决定，可进可守，不要为了数量硬凑动作。",
    "11) 若看到对手 relationship 和 recent_shared_events，要按你们之间的具体历史说话和决策。",
    "12) 若使用 paint，可在共享调色板与构图区内选择更有构图感的颜色，不要机械重复同一种色块。",
    "13) 这不是临摹现实物体，而是在共同完成一幅神话像素壁画。"
  ].join("\n");
}

export function buildAgentUserPrompt({
  round,
  width,
  height,
  selfState,
  opponents,
  treaties,
  lastEvents,
  validActionHints,
  artDirection
}: {
  round: number;
  width: number;
  height: number;
  selfState: Partial<AgentState>;
  opponents: OpponentSnapshot[];
  treaties: unknown[];
  lastEvents: unknown[];
  validActionHints: ActionHints;
  artDirection: ArtDirection;
}): string {
  return [
    `round: ${round}`,
    `canvas_size: ${width}x${height}`,
    `coordinate_range: x=0..${width - 1}, y=0..${height - 1}`,
    `art_direction: ${JSON.stringify(artDirection)}`,
    `self_state: ${JSON.stringify(selfState)}`,
    `visible_opponents: ${JSON.stringify(opponents)}`,
    `active_treaties: ${JSON.stringify(treaties)}`,
    `last_round_events: ${JSON.stringify(lastEvents)}`,
    `valid_action_hints: ${JSON.stringify(validActionHints)}`,
    "energy_rule: paint=1, fortify=1, invade=2, burst=3(cooldown=3)",
    "请仅返回TurnDecision JSON。"
  ].join("\n");
}
