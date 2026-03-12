import { expect, test } from "bun:test";
import { PixelWarEngine } from "../engine";

test("run emits schema_version at the top level", async () => {
  const engine = new PixelWarEngine({
    dryRun: true,
    rounds: 1,
    width: 8,
    height: 8,
    agentCount: 2
  });

  const result = await engine.run();

  expect(result.schema_version).toBe("1.0");
});

test("dry-run produces the same replay for identical inputs", async () => {
  const left = await new PixelWarEngine({
    dryRun: true,
    rounds: 2,
    width: 8,
    height: 8,
    agentCount: 3
  }).run();
  const right = await new PixelWarEngine({
    dryRun: true,
    rounds: 2,
    width: 8,
    height: 8,
    agentCount: 3
  }).run();

  expect(left).toEqual(right);
});
