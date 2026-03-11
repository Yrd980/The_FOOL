import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App room shell", () => {
  it("renders the hallway shell with sidebar, conversation dock, and room floor", () => {
    render(<App />);
    expect(screen.getByRole("complementary", { name: /presence sidebar/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /conversation dock/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /spatial room floor/i })).toBeInTheDocument();
  });
});
