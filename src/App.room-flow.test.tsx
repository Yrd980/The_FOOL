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

describe("Room interaction flows", () => {
  it("room switching updates aria-pressed on room buttons", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Initially, Main Stage should be active
    expect(screen.getByRole("button", { name: /go to main stage/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /go to team room 1/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    // Switch to Team Room 1
    await user.click(screen.getByRole("button", { name: /go to team room 1/i }));

    expect(screen.getByRole("button", { name: /go to team room 1/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /go to main stage/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("pause/resume cycle toggles the feed button label", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Feed starts unpaused
    expect(screen.getByRole("button", { name: /pause feed/i })).toBeInTheDocument();

    // Pause it
    await user.click(screen.getByRole("button", { name: /pause feed/i }));
    expect(screen.getByRole("button", { name: /resume feed/i })).toBeInTheDocument();

    // Resume it
    await user.click(screen.getByRole("button", { name: /resume feed/i }));
    expect(screen.getByRole("button", { name: /pause feed/i })).toBeInTheDocument();
  });

  it("toggles audio mode via control panel buttons", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Initially "Hear nearby" should be active (default audioMode is "nearby")
    expect(screen.getByRole("button", { name: /hear nearby/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /focus audio/i })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: /focus audio/i }));
    expect(screen.getByRole("button", { name: /focus audio/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /hear nearby/i })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: /mute all/i }));
    expect(screen.getByRole("button", { name: /mute all/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /focus audio/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("quiet-room and empty-room scenarios render fallback copy", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /simulate quiet room/i }));
    expect(screen.getByText(/this room is quiet right now/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /simulate empty room/i }));
    expect(screen.getByText(/this room is empty/i)).toBeInTheDocument();
  });

  it("reset demo restores Main Stage as the active room", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Switch away from Main Stage
    await user.click(screen.getByRole("button", { name: /go to team room 1/i }));
    expect(screen.getByRole("button", { name: /go to team room 1/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Reset demo
    await user.click(screen.getByRole("button", { name: /reset demo/i }));

    // Main Stage should be active again
    expect(screen.getByRole("button", { name: /go to main stage/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /go to team room 1/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
