import type { WidgetKind } from "@homarr/definitions";

export interface BoardSetupProgressInput {
  itemKinds: readonly WidgetKind[];
}

export const getBoardSetupProgress = ({ itemKinds }: BoardSetupProgressInput) => {
  const steps = {
    content: itemKinds.some((kind) => kind !== "app"),
    app: itemKinds.includes("app"),
  };
  const completedCount = Object.values(steps).filter(Boolean).length;

  return {
    steps,
    completedCount,
    totalCount: Object.keys(steps).length,
    isComplete: completedCount === Object.keys(steps).length,
  };
};
