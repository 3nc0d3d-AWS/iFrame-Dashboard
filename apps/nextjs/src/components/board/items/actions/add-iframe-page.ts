import { createId } from "@homarr/common";
import type { Modify } from "@homarr/common/types";
import type { WidgetKind } from "@homarr/definitions";

import type { Board, ContainerSection, Item } from "~/app/[locale]/boards/_types";
import { addContainerCallback } from "~/components/board/sections/container/actions/add-container";

export interface AddIframePageInput {
  /** Page name — becomes the collapsible section's title. Required. */
  title: string;
  /** URL to embed in the iframe. */
  embedUrl: string;
  /** Pre-generated ids (optional); supplied so callers can reference the result. */
  sectionId?: string;
  itemId?: string;
  /** Extra iframe widget options (permission switches). */
  iframeOptions?: Record<string, unknown>;
}

/**
 * Adds an "iFrame page": a collapsible container section titled with `title`,
 * holding a single iframe widget that fills it. This is the section-based collapse
 * model — collapsing the section reflows the board and reclaims the space.
 */
export const addIframePageCallback =
  ({ title, embedUrl, sectionId = createId(), itemId = createId(), iframeOptions = {} }: AddIframePageInput) =>
  (board: Board): Board => {
    const withContainer = addContainerCallback({
      id: sectionId,
      options: { title, collapsible: true, showLabel: true },
    })(board);

    // addContainerCallback returns the input board unchanged when it cannot place
    // a container (e.g. the board is full) — don't orphan an iframe in that case.
    if (withContainer === board) return board;

    const container = withContainer.sections.find(
      (section): section is ContainerSection => section.id === sectionId && section.kind === "container",
    );
    if (!container) return board;

    // Build the iframe's layouts directly from the container's, so it fills the
    // new page in every layout and always lands INSIDE the container. Going through
    // createItemCallback risked its "board is full" fallback dropping the iframe
    // onto the main grid instead (leaving an empty page).
    const layouts = container.layouts.map((layout) => ({
      width: layout.width,
      height: layout.height,
      xOffset: 0,
      yOffset: 0,
      sectionId,
      layoutId: layout.layoutId,
    }));

    const iframeItem = {
      id: itemId,
      kind: "iframe",
      options: { embedUrl, allowScrolling: true, ...iframeOptions },
      layouts,
      integrationIds: [],
      advancedOptions: { title: null, customCssClasses: [], borderColor: "" },
    } satisfies Modify<Item, { kind: WidgetKind }>;

    return {
      ...withContainer,
      items: withContainer.items.concat(iframeItem),
    };
  };
