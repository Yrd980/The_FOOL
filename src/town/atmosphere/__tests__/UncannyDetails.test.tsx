import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { UncannyDetails } from "../UncannyDetails";
import type { UncannyDetail } from "../types";

afterEach(cleanup);

const TILE_SIZE = 32;

describe("UncannyDetails", () => {
  it("renders crack glow with animation class", () => {
    const details: UncannyDetail[] = [
      { kind: "crack-glow", tileX: 5, tileY: 5 },
    ];
    const { container } = render(
      <UncannyDetails items={details} tileSize={TILE_SIZE} />
    );
    const el = container.querySelector('[data-kind="crack-glow"]');
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass("uncanny-crack-glow");
  });

  it("renders CRT snow window with flicker class", () => {
    const details: UncannyDetail[] = [
      { kind: "crt-snow-window", tileX: 3, tileY: 3 },
    ];
    const { container } = render(
      <UncannyDetails items={details} tileSize={TILE_SIZE} />
    );
    const el = container.querySelector('[data-kind="crt-snow-window"]');
    expect(el).toHaveClass("uncanny-crt-snow-window");
  });

  it("positions elements at tile coordinates", () => {
    const details: UncannyDetail[] = [
      { kind: "eternal-phone-booth", tileX: 6, tileY: 9 },
    ];
    const { container } = render(
      <UncannyDetails items={details} tileSize={TILE_SIZE} />
    );
    const el = container.querySelector('[data-kind="eternal-phone-booth"]');
    expect(el).toHaveStyle({ left: "192px", top: "288px" });
  });
});
