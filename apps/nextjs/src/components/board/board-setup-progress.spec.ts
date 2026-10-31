import { describe, expect, test } from "vitest";

import { getBoardSetupProgress } from "./board-setup-progress";

describe("getBoardSetupProgress", () => {
  test("derives resumable progress from the board", () => {
    expect(getBoardSetupProgress({ itemKinds: ["clock", "app"] })).toEqual({
      steps: { content: true, app: true },
      completedCount: 2,
      totalCount: 2,
      isComplete: true,
    });
  });

  test("does not count an app as a data widget", () => {
    expect(getBoardSetupProgress({ itemKinds: ["app"] })).toMatchObject({
      steps: { content: false, app: true },
      completedCount: 1,
      isComplete: false,
    });
  });
});
