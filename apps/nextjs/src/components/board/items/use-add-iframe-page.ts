import { useCallback } from "react";

import { useRequiredBoard } from "@homarr/boards/context";
import { usePersistBoard } from "@homarr/boards/updater";

import type { AddIframePageInput } from "./actions/add-iframe-page";
import { addIframePageCallback } from "./actions/add-iframe-page";

export const useAddIframePage = () => {
  const board = useRequiredBoard();
  // Persist immediately (not just the local cache): the new section must exist
  // server-side so its collapse toggle (section.changeCollapsed) works and the
  // page survives a reload.
  const { updateAndPersistBoard } = usePersistBoard(board);

  return useCallback(
    (input: AddIframePageInput) => updateAndPersistBoard(addIframePageCallback(input)),
    [updateAndPersistBoard],
  );
};
