import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";

afterEach(() => {
  cleanup();
});

describe("App room shell", () => {
  it("renders the hallway shell with sidebar, conversation dock, and room floor", () => {
    render(<App />);
    expect(screen.getByRole("complementary", { name: /presence sidebar/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /conversation dock/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /spatial room floor/i })).toBeInTheDocument();
  });

  it("renders room controls for audio mode, room switching, and demo state injection", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /go to main stage/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /go to team room 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hear nearby/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /focus audio/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mute all/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pause feed/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /inject wave over/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /simulate quiet room/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /simulate empty room/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset demo/i })).toBeInTheDocument();
  });

  it("pauses the feed and resets the demo state", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /pause feed/i }));
    expect(screen.getByRole("button", { name: /resume feed/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /reset demo/i }));
    expect(screen.getByRole("button", { name: /go to main stage/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
