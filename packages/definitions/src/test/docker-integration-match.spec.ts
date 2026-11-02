import { describe, expect, it } from "vitest";

import {
  extractContainerImageName,
  matchIntegrationKind,
  matchIntegrationKindFromContainer,
} from "../docker-integration-match";

describe("extractContainerImageName", () => {
  it("extracts name from full image reference", () => {
    expect(extractContainerImageName("linuxserver/jellyfin:latest")).toBe("jellyfin");
  });

  it("extracts name from ghcr image", () => {
    expect(extractContainerImageName("ghcr.io/org/emby:v5")).toBe("emby");
  });

  it("handles plain image name", () => {
    expect(extractContainerImageName("jellyfin")).toBe("jellyfin");
  });

  it("handles empty string", () => {
    expect(extractContainerImageName("")).toBe("");
  });
});

describe("matchIntegrationKind", () => {
  it("matches exact kind name", () => {
    expect(matchIntegrationKind("jellyfin")).toBe("jellyfin");
  });

  it("matches case-insensitively", () => {
    expect(matchIntegrationKind("Jellyfin")).toBe("jellyfin");
  });

  it("matches icon slug for pi-hole", () => {
    expect(matchIntegrationKind("pi-hole")).toBe("piHole");
  });

  it("matches alias pihole", () => {
    expect(matchIntegrationKind("pihole")).toBe("piHole");
  });

  it("matches alias adguardhome", () => {
    expect(matchIntegrationKind("adguardhome")).toBe("adGuardHome");
  });

  it("matches alias homeassistant", () => {
    expect(matchIntegrationKind("homeassistant")).toBe("homeAssistant");
  });

  it("matches substring in image name", () => {
    expect(matchIntegrationKind("hotio-jellyfin")).toBe("jellyfin");
  });

  it("returns null for unknown", () => {
    expect(matchIntegrationKind("nginx")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(matchIntegrationKind("")).toBeNull();
  });
});

describe("matchIntegrationKindFromContainer", () => {
  it("matches from image name first", () => {
    expect(
      matchIntegrationKindFromContainer({
        image: "linuxserver/jellyfin:latest",
        name: "my-jellyfin",
      }),
    ).toBe("jellyfin");
  });

  it("falls back to container name", () => {
    expect(
      matchIntegrationKindFromContainer({
        image: "custom/myapp:latest",
        name: "emby",
      }),
    ).toBe("emby");
  });

  it("returns null when neither matches", () => {
    expect(
      matchIntegrationKindFromContainer({
        image: "nginx:latest",
        name: "web-proxy",
      }),
    ).toBeNull();
  });

  it("excludes dockerHub even when image contains docker", () => {
    expect(
      matchIntegrationKindFromContainer({
        image: "portainer/portainer-ce:latest",
        name: "docker-proxy",
      }),
    ).toBeNull();
  });

  it("excludes ical from container matching", () => {
    expect(
      matchIntegrationKindFromContainer({
        image: "ical-relay:latest",
        name: "ical",
      }),
    ).toBeNull();
  });

  it("excludes github from container matching", () => {
    expect(
      matchIntegrationKindFromContainer({
        image: "github-runner:latest",
        name: "github-actions",
      }),
    ).toBeNull();
  });

  it("matches Emby from its official image name", () => {
    expect(
      matchIntegrationKindFromContainer({
        image: "linuxserver/emby:latest",
        name: "emby",
      }),
    ).toBe("emby");
  });
});
