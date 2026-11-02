import { describe, expect, it } from "vitest";

import {
  isHttpUrl,
  normalizeServiceUrl,
  resolveDiscoveredAppUrl,
  resolveIntegrationDraftUrl,
  takeNewSourceIds,
} from "./discovery-selection";

describe("takeNewSourceIds", () => {
  it("keeps same-kind service instances independent and does not reselect them after refresh", () => {
    const seen = new Set<string>();
    const jellyfinInstances = ["docker:host:jellyfin-hd", "docker:host:jellyfin-4k"];

    expect(takeNewSourceIds(jellyfinInstances, seen)).toEqual(jellyfinInstances);
    expect(takeNewSourceIds(jellyfinInstances, seen)).toEqual([]);
  });

  it("keeps an explicit app URL and falls back through discovery and server-derived addresses", () => {
    expect(resolveDiscoveredAppUrl("https://manual.example", "https://label.example", "http://host:3000")).toBe(
      "https://manual.example",
    );
    expect(resolveDiscoveredAppUrl(undefined, "https://label.example", "http://host:3000")).toBe(
      "https://label.example",
    );
    expect(resolveDiscoveredAppUrl(undefined, null, "http://host:3000")).toBe("http://host:3000");
    expect(resolveDiscoveredAppUrl(undefined, null, null)).toBe("");
  });

  it("regenerates integration URLs from the usual server address without replacing manual edits", () => {
    expect(
      resolveIntegrationDraftUrl({
        currentUrl: "http://docker-host:8096",
        overridden: false,
        serverUrl: "http://home.lan:8096",
        fallbackUrl: "http://docker-host:8096",
      }),
    ).toBe("http://home.lan:8096");
    expect(
      resolveIntegrationDraftUrl({
        currentUrl: "https://jellyfin.custom.example",
        overridden: true,
        serverUrl: "http://home.lan:8096",
        fallbackUrl: "http://docker-host:8096",
      }),
    ).toBe("https://jellyfin.custom.example");
  });

  it("normalizes HTTP, HTTPS, and bare self-hosted service addresses", () => {
    expect(isHttpUrl("http://home.lan:8096")).toBe(true);
    expect(isHttpUrl("https://home.example/jellyfin")).toBe(true);
    expect(normalizeServiceUrl("home.lan:8096")).toBe("http://home.lan:8096");
    expect(normalizeServiceUrl("0.0.0.0:8096")).toBe("http://0.0.0.0:8096");
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("file:///etc/passwd")).toBe(false);
  });
});
