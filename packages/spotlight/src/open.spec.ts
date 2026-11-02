import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  consumePendingSpotlightOpen,
  hasPendingSpotlightOpen,
  openSpotlight,
  spotlightOpenEvent,
} from "./open";

describe("lazy Spotlight open bridge", () => {
  beforeEach(() => {
    consumePendingSpotlightOpen();
  });

  it("keeps a pre-mount open request until the lazy component consumes it", () => {
    const listener = vi.fn();
    window.addEventListener(spotlightOpenEvent, listener);

    openSpotlight({ mode: "apps", query: "rada" });

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0]?.[0]).toMatchObject({
      detail: { mode: "apps", query: "rada" },
    });
    expect(consumePendingSpotlightOpen()).toEqual({ mode: "apps", query: "rada" });
    expect(consumePendingSpotlightOpen()).toBeNull();
    window.removeEventListener(spotlightOpenEvent, listener);
  });

  it("defaults to search and lets a listener installed after the request discover the pending intent", () => {
    openSpotlight();

    expect(hasPendingSpotlightOpen()).toBe(true);
    expect(consumePendingSpotlightOpen()).toEqual({ mode: "search" });
    expect(hasPendingSpotlightOpen()).toBe(false);
  });
});
