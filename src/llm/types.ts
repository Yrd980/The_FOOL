export interface LLMProvider {
  readonly modelName: string;
  generateDecision(args: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
  }): Promise<unknown>;
}
