import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { SpatialFoldBoundary } from "../SpatialFoldBoundary";

afterEach(cleanup);

describe("SpatialFoldBoundary", () => {
  it("renders the boundary container with mask and mirror layers", () => {
    const { container } = render(
      <SpatialFoldBoundary mapWidth={576} mapHeight={576} />
    );
    expect(container.querySelector(".spatial-fold-boundary")).toBeInTheDocument();
    expect(container.querySelector(".spatial-fold-mirror")).toBeInTheDocument();
    expect(container.querySelector(".spatial-fold-mask")).toBeInTheDocument();
  });

  it("renders fallback gradient when useFallback is true", () => {
    const { container } = render(
      <SpatialFoldBoundary mapWidth={576} mapHeight={576} useFallback />
    );
    expect(container.querySelector(".spatial-fold-mirror")).toBeNull();
    expect(container.querySelector(".spatial-fold-mask")).toBeInTheDocument();
  });
});
