import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../resizable";

// These assertions pin the react-resizable-panels v4 contract the wrapper is
// built on: the Group/Panel/Separator exports, and the `aria-orientation` the
// handle's orientation-dependent styles key off (it is the inverse of the
// group's orientation). A future major that renames either one fails here
// instead of silently rendering an unstyled or missing handle.

function renderGroup(orientation: "horizontal" | "vertical") {
  return render(
    <ResizablePanelGroup orientation={orientation}>
      <ResizablePanel defaultSize="75%" minSize="50%">
        <div>left</div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="25%" minSize="15%" maxSize="40%">
        <div>right</div>
      </ResizablePanel>
    </ResizablePanelGroup>,
  );
}

describe("resizable", () => {
  it("renders both panels and a separator handle", () => {
    const { container } = renderGroup("horizontal");

    expect(screen.getByText("left")).toBeInTheDocument();
    expect(screen.getByText("right")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-panel]")).toHaveLength(2);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("gives the handle the inverse aria-orientation of its group", () => {
    const { unmount } = renderGroup("horizontal");
    expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", "vertical");
    unmount();

    renderGroup("vertical");
    expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("keeps the orientation-dependent handle styles on the separator element", () => {
    renderGroup("vertical");

    const separator = screen.getByRole("separator");
    expect(separator.className).toContain("aria-[orientation=horizontal]:h-px");
    expect(separator.className).toContain("aria-[orientation=horizontal]:w-full");
  });
});
