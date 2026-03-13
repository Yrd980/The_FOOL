import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { CivicProps } from "../CivicProps";
import type { CivicProp } from "../types";

afterEach(cleanup);

const TILE_SIZE = 32;

describe("CivicProps", () => {
  it("renders a lamp post at the correct tile position", () => {
    const props: CivicProp[] = [
      { kind: "lamp-post", tileX: 3, tileY: 5, facing: 0 },
    ];
    const { container } = render(
      <CivicProps items={props} tileSize={TILE_SIZE} />
    );
    const lamp = container.querySelector('[data-kind="lamp-post"]');
    expect(lamp).toBeInTheDocument();
    expect(lamp).toHaveStyle({ left: "96px", top: "160px" });
  });

  it("renders multiple prop kinds", () => {
    const props: CivicProp[] = [
      { kind: "lamp-post", tileX: 0, tileY: 0, facing: 0 },
      { kind: "bench", tileX: 1, tileY: 1, facing: 1 },
      { kind: "notice-board", tileX: 2, tileY: 2, facing: 0 },
    ];
    const { container } = render(
      <CivicProps items={props} tileSize={TILE_SIZE} />
    );
    expect(container.querySelectorAll("[data-kind]")).toHaveLength(3);
  });

  it("renders nothing when items array is empty", () => {
    const { container } = render(<CivicProps items={[]} tileSize={TILE_SIZE} />);
    expect(container.querySelector("[data-kind]")).toBeNull();
  });
});
