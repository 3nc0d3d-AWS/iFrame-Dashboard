import { describe, expect, test } from "vitest";

import {
  onboardingCompleteSetupSchema,
  onboardingCreateIntegrationSchema,
  onboardingDiscoveredAppSchema,
} from "./onboarding";

describe("onboarding address validation", () => {
  test.each(["server.local:8096", "0.0.0.0:3000", "jellyfin", "/services/jellyfin"])(
    "accepts the self-hosted address %s",
    (url) => {
      expect(onboardingCreateIntegrationSchema.safeParse({ name: "Service", url }).success).toBe(true);
    },
  );

  test("accepts HTTP services and icon identifiers", () => {
    expect(
      onboardingDiscoveredAppSchema.safeParse({
        name: "Jellyfin",
        sourceId: "docker:jellyfin",
        href: "http://jellyfin:8096",
        pingUrl: "https://jellyfin.example.com/ping",
        iconUrl: "jellyfin",
        description: "TV automation",
      }).success,
    ).toBe(true);
  });

  test("accepts bounded integration metadata and rejects empty or oversized metadata", () => {
    expect(
      onboardingCreateIntegrationSchema.safeParse({
        name: "Jellyfin",
        url: "http://jellyfin:8096",
        pingUrl: "https://jellyfin.example.com/ping",
        iconUrl: "https://icons.example/jellyfin.svg",
        description: "TV automation",
      }).success,
    ).toBe(true);
    expect(
      onboardingCreateIntegrationSchema.safeParse({
        name: "Jellyfin",
        url: "http://jellyfin:8096",
        pingUrl: "",
      }).success,
    ).toBe(false);
    expect(
      onboardingCreateIntegrationSchema.safeParse({
        name: "Jellyfin",
        url: "http://jellyfin:8096",
        description: "x".repeat(513),
      }).success,
    ).toBe(false);
  });

  test("accepts custom app and ping addresses", () => {
    expect(
      onboardingDiscoveredAppSchema.safeParse({
        name: "Database",
        href: "postgres://database:5432",
        pingUrl: "database.local:5432",
        iconUrl: null,
      }).success,
    ).toBe(true);
  });

  test("requires every app submitted to completeSetup to have a non-empty address", () => {
    const input = {
      server: { defaultLocale: "en", defaultColorScheme: "dark" },
      board: {
        name: "dashboard",
        primaryColor: "#228BE6",
        secondaryColor: "#15AABF",
        itemRadius: "md",
      },
      apps: [{ sourceId: "docker:status", name: "Status", href: null, iconUrl: null }],
    };

    expect(onboardingCompleteSetupSchema.safeParse(input).success).toBe(false);
    expect(
      onboardingCompleteSetupSchema.safeParse({
        ...input,
        apps: [{ ...input.apps[0], href: "status.local:3001" }],
      }).success,
    ).toBe(true);
  });

  test("accepts Docker source IDs up to 512 characters", () => {
    const input = {
      server: { defaultLocale: "en", defaultColorScheme: "dark" },
      board: {
        name: "dashboard",
        primaryColor: "#228BE6",
        secondaryColor: "#15AABF",
        itemRadius: "md",
      },
      selectedDockerSourceIds: ["x".repeat(512)],
    };

    expect(onboardingCompleteSetupSchema.safeParse(input).success).toBe(true);
    expect(
      onboardingCompleteSetupSchema.safeParse({ ...input, selectedDockerSourceIds: ["x".repeat(513)] }).success,
    ).toBe(false);
  });

  test("accepts board column counts from 8 through 24", () => {
    const input = {
      server: { defaultLocale: "en", defaultColorScheme: "dark" },
      board: {
        name: "dashboard",
        primaryColor: "#228BE6",
        secondaryColor: "#15AABF",
        itemRadius: "md",
        columnCount: 8,
      },
    };

    expect(onboardingCompleteSetupSchema.safeParse(input).success).toBe(true);
    expect(
      onboardingCompleteSetupSchema.safeParse({ ...input, board: { ...input.board, columnCount: 24 } }).success,
    ).toBe(true);
    expect(
      onboardingCompleteSetupSchema.safeParse({ ...input, board: { ...input.board, columnCount: 7 } }).success,
    ).toBe(false);
    expect(
      onboardingCompleteSetupSchema.safeParse({ ...input, board: { ...input.board, columnCount: 25 } }).success,
    ).toBe(false);
  });
});
