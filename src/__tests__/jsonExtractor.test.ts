import { describe, expect, test } from "bun:test";
import { extractJsonObject } from "../llm/jsonExtractor";

describe("extractJsonObject", () => {
  test("parses fenced json", () => {
    expect(extractJsonObject("```json\n{\"ok\":true}\n```")).toEqual({ ok: true });
  });

  test("parses brace-delimited json inside prose", () => {
    expect(extractJsonObject("answer: {\"ok\":true}")).toEqual({ ok: true });
  });

  test("throws when no json object exists", () => {
    expect(() => extractJsonObject("plain text only")).toThrow(
      "LLM response does not contain valid JSON object."
    );
  });
});
