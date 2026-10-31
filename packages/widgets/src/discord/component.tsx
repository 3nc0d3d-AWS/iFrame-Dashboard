"use client";

import { Anchor, Box, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconBrandDiscord } from "@tabler/icons-react";

import { useI18n } from "@homarr/translation/client";

import type { WidgetComponentProps } from "../definition";
import classes from "./component.module.css";

export default function DiscordWidget({ options, isEditMode }: WidgetComponentProps<"discord">) {
  const t = useI18n("widget.discord");
  const serverId = options.serverId.trim();

  if (serverId === "") return <NoServer />;

  return (
    <Stack h="100%" w="100%" gap={0}>
      <Box className={classes.frame} style={{ flex: 1, minHeight: 0 }}>
        <iframe
          loading="lazy"
          style={isEditMode ? { userSelect: "none", pointerEvents: "none" } : undefined}
          className={classes.iframe}
          src={`https://discord.com/widget?id=${encodeURIComponent(serverId)}&theme=${options.theme}`}
          title="Discord"
          allow=""
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        >
          <Text>{t("error.noFrameSupport")}</Text>
        </iframe>
      </Box>
    </Stack>
  );
}

const NoServer = () => {
  const t = useI18n("widget.discord");

  return (
    <Stack align="center" justify="center" h="100%" gap="xs" p="md">
      <ThemeIcon variant="light" size="xl" radius="md" color="indigo">
        <IconBrandDiscord />
      </ThemeIcon>
      <Text fw={600} ta="center">
        {t("error.noServer.title")}
      </Text>
      <Text size="xs" c="dimmed" ta="center">
        {t("error.noServer.description")}
      </Text>
      <Anchor
        href="https://support.discord.com/hc/en-us/articles/360045138571-Server-Widget"
        target="_blank"
        rel="noopener noreferrer"
        size="xs"
      >
        {t("error.noServer.help")}
      </Anchor>
    </Stack>
  );
};
