import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom 20 implements neither ResizeObserver nor DOMRect, and
// react-resizable-panels v4 constructs both from the owner document's window as
// soon as a group mounts. Geometry is all zeroes under jsdom either way, so the
// stubs only need to exist — a newer jsdom would make them unnecessary.
class ResizeObserverStub implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class DOMRectStub implements DOMRect {
  constructor(
    readonly x = 0,
    readonly y = 0,
    readonly width = 0,
    readonly height = 0,
  ) {}

  get top() {
    return Math.min(this.y, this.y + this.height);
  }
  get right() {
    return Math.max(this.x, this.x + this.width);
  }
  get bottom() {
    return Math.max(this.y, this.y + this.height);
  }
  get left() {
    return Math.min(this.x, this.x + this.width);
  }

  static fromRect(other?: DOMRectInit) {
    return new DOMRectStub(other?.x, other?.y, other?.width, other?.height);
  }

  toJSON() {
    const { x, y, width, height, top, right, bottom, left } = this;
    return { x, y, width, height, top, right, bottom, left };
  }
}

// Checked by type, not with `in`: vitest's jsdom environment copies the key
// onto the global object even when jsdom leaves the value undefined.
if (typeof window.ResizeObserver !== "function") {
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: ResizeObserverStub,
  });
}

if (typeof window.DOMRect !== "function") {
  Object.defineProperty(window, "DOMRect", {
    writable: true,
    value: DOMRectStub,
  });
}
