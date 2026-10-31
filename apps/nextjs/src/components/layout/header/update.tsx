"use client";

import type { PropsWithChildren } from "react";

import type { RouterOutputs } from "@homarr/api";

interface UpdateIndicatorProps extends PropsWithChildren {
  availableUpdates: RouterOutputs["updateChecker"]["getAvailableUpdates"] | undefined;
  disabled: boolean;
}

// iFrame-panel fork: the upstream update checker points at Homarr releases, which
// must never be applied to this fork. The indicator is removed entirely.
export const UpdateIndicator = ({ children }: UpdateIndicatorProps) => {
  return children;
};

interface AvailableUpdatesMenuItemProps {
  availableUpdates: RouterOutputs["updateChecker"]["getAvailableUpdates"] | undefined;
}

// iFrame-panel fork: no upstream update notices in the avatar menu.
export const AvailableUpdatesMenuItem = (_props: AvailableUpdatesMenuItemProps) => {
  return null;
};
