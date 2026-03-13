import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { SupernaturalTraces } from "../SupernaturalTraces";
import type { SupernaturalTrace } from "../types";

afterEach(cleanup);

const TILE_SIZE = 32;

describe("SupernaturalTraces", () => {
  it("renders plaza brand scorch spanning multiple tiles", () => {
    const traces: SupernaturalTrace[] = [
      { kind: "plaza-brand-scorch", tileX: 8, tileY: 8, span: { w: 3, h: 3 } },
    ];
    const { container } = render(
      <SupernaturalTraces items={traces} tileSize={TILE_SIZE} />
    );
    const el = container.querySelector('[data-kind="plaza-brand-scorch"]');
    expect(el).toBeInTheDocument();
    expect(el).toHaveStyle({ width: "96px", height: "96px" });
    expect(el).toHaveClass("supernatural-plaza-brand-scorch");
  });

  it("renders heat distortion at single tile", () => {
    const traces: SupernaturalTrace[] = [
      { kind: "heat-distortion", tileX: 12, tileY: 12 },
    ];
    const { container } = render(
      <SupernaturalTraces items={traces} tileSize={TILE_SIZE} />
    );
    const el = container.querySelector('[data-kind="heat-distortion"]');
    expect(el).toHaveStyle({ width: "32px", height: "32px" });
    expect(el).toHaveClass("supernatural-heat-distortion");
  });

  it("renders the crimson X glyph inside plaza brand", () => {
    const traces: SupernaturalTrace[] = [
      { kind: "plaza-brand-scorch", tileX: 8, tileY: 8, span: { w: 3, h: 3 } },
    ];
    const { container } = render(
      <SupernaturalTraces items={traces} tileSize={TILE_SIZE} />
    );
    const el = container.querySelector('[data-kind="plaza-brand-scorch"]');
    expect(el?.textContent).toContain("✕");
  });
});
