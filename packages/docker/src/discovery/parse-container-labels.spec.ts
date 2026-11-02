import { describe, expect, it } from "vitest";

import { parseContainerLabels } from "./parse-container-labels";

const container = (Labels: Record<string, string>, Id = "container-1") => ({ Id, Labels });

describe("parseContainerLabels", () => {
  it("parses complete Homarr labels", () => {
    expect(
      parseContainerLabels(
        container({
          "homarr.name": "Jellyfin",
          "homarr.group": "Media",
          "homarr.href": "http://jellyfin:8096",
          "homarr.icon": "jellyfin.svg",
          "homarr.description": "TV",
          "homarr.ping": "http://jellyfin:8096/ping",
          "homarr.id": "jellyfin-main",
          "homarr.board": "dashboard",
          "homarr.integration": "jellyfin",
          "homarr.widget": "calendar",
        }),
        "socket",
      ),
    ).toEqual({
      sourceId: "docker:socket:jellyfin-main",
      containerId: "container-1",
      host: "socket",
      group: "Media",
      name: "Jellyfin",
      href: "http://jellyfin:8096",
      icon: "jellyfin.svg",
      description: "TV",
      pingUrl: "http://jellyfin:8096/ping",
      externalId: "jellyfin-main",
      boardName: "dashboard",
      integrationKind: "jellyfin",
      widgetKind: "calendar",
    });
  });

  it("supports Homepage labels when Homarr labels are absent", () => {
    expect(
      parseContainerLabels(
        container({
          "homepage.name": "Jellyfin",
          "homepage.group": "Media",
          "homepage.href": "http://jellyfin:8096",
          "homepage.icon": "jellyfin.svg",
        }),
        "remote:2375",
      ),
    ).toMatchObject({
      sourceId: "docker:remote%3A2375:container-1",
      name: "Jellyfin",
      group: "Media",
      href: "http://jellyfin:8096",
      icon: "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/jellyfin.svg",
    });
  });

  it("keeps host and service identifiers unambiguous", () => {
    const first = parseContainerLabels(
      container({ "homarr.name": "Service", "homarr.href": "http://service", "homarr.id": "service" }),
      "remote:2375",
    );
    const second = parseContainerLabels(
      container({ "homarr.name": "Service", "homarr.href": "http://service", "homarr.id": "2375:service" }),
      "remote",
    );

    expect(first?.sourceId).toBe("docker:remote%3A2375:service");
    expect(second?.sourceId).toBe("docker:remote:2375%3Aservice");
    expect(first?.sourceId).not.toBe(second?.sourceId);
  });

  it("keeps a labeled service without a group for root placement", () => {
    expect(
      parseContainerLabels(
        container({
          "homarr.name": "Status",
          "homarr.href": "http://status:3001",
          "homarr.widget": "clock",
        }),
        "socket",
      ),
    ).toMatchObject({ name: "Status", href: "http://status:3001", group: undefined, widgetKind: "clock" });
  });

  it("does not mix Homepage required fields into an explicitly Homarr-labeled service", () => {
    expect(
      parseContainerLabels(
        container({
          "homarr.name": "Jellyfin",
          "homepage.group": "Media",
          "homepage.href": "http://jellyfin:8096",
        }),
        "socket",
      ),
    ).toBeNull();
  });

  it("can disable Homepage fallback", () => {
    expect(
      parseContainerLabels(
        container({
          "homepage.name": "Jellyfin",
          "homepage.group": "Media",
          "homepage.href": "http://jellyfin:8096",
        }),
        "socket",
        { readHomepageLabels: false },
      ),
    ).toBeNull();
  });

  it("ignores hidden and incomplete containers", () => {
    expect(
      parseContainerLabels(
        container({
          "homarr.hide": "true",
          "homarr.name": "Jellyfin",
          "homarr.group": "Media",
          "homarr.href": "http://jellyfin:8096",
        }),
        "socket",
      ),
    ).toBeNull();
    expect(parseContainerLabels(container({ "homarr.name": "Jellyfin" }), "socket")).toBeNull();
  });

  it("trims values and ignores invalid integration and widget kinds", () => {
    expect(
      parseContainerLabels(
        container({
          "homarr.name": " Jellyfin ",
          "homarr.group": " Media ",
          "homarr.href": " http://jellyfin:8096 ",
          "homarr.integration": "not-real",
          "homarr.widget": "not-real",
        }),
        "socket",
      ),
    ).toMatchObject({
      name: "Jellyfin",
      group: "Media",
      href: "http://jellyfin:8096",
      integrationKind: undefined,
      widgetKind: undefined,
    });
  });
});
