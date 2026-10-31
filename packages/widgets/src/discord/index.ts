import { IconBrandDiscord, IconExternalLink } from "@tabler/icons-react";

import { createWidgetDefinition } from "../definition";
import { optionsBuilder } from "../options";

const createOptions = () =>
  optionsBuilder.from((factory) => ({
    serverId: factory.text({ withDescription: true }),
    theme: factory.select({
      options: [
        { value: "dark", label: (t) => t("widget.discord.option.theme.option.dark") },
        { value: "light", label: (t) => t("widget.discord.option.theme.option.light") },
      ],
      defaultValue: "dark",
      allowDeselect: false,
    }),
  }));

export const { definition, componentLoader } = createWidgetDefinition("discord", {
  supportsAdvancedFocus: false,
  icon: IconBrandDiscord,
  contextActions: ({ options }) => {
    const serverId = options.serverId;
    if (typeof serverId !== "string" || serverId.trim() === "") return [];

    return [
      {
        key: "open-discord",
        label: "widget.common.openInNewTab.label",
        icon: IconExternalLink,
        onClick: () =>
          window.open(
            `https://discord.com/widget?id=${encodeURIComponent(serverId.trim())}`,
            "_blank",
            "noopener,noreferrer",
          ),
      },
    ];
  },
  createOptions,
}).withDynamicImport(() => import("./component"));
