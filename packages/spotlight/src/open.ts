"use client";

export const spotlightOpenEvent = "homarr:spotlight:open";

export type SpotlightMode =
  | "search"
  | "apps"
  | "command"
  | "preferences"
  | "assistant"
  | "external"
  | "userGroup";

export interface OpenSpotlightOptions {
  mode?: SpotlightMode;
  query?: string;
}

export interface SpotlightOpenIntent {
  mode: SpotlightMode;
  query?: string;
}

let pendingSpotlightOpen: SpotlightOpenIntent | null = null;

const requestSpotlightMount = (intent: SpotlightOpenIntent) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<SpotlightOpenIntent>(spotlightOpenEvent, { detail: intent }));
  }
};

export const openSpotlight = (options: OpenSpotlightOptions = {}) => {
  const intent: SpotlightOpenIntent = {
    mode: options.mode ?? "search",
  };
  if (options.query !== undefined) intent.query = options.query;

  pendingSpotlightOpen = intent;
  requestSpotlightMount(intent);
};

export const consumePendingSpotlightOpen = () => {
  const pending = pendingSpotlightOpen;
  pendingSpotlightOpen = null;
  return pending;
};

export const hasPendingSpotlightOpen = () => pendingSpotlightOpen !== null;
