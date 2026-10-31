"use client";

import { Box, Center, Loader, Stack, Text, Title } from "@mantine/core";
import { IconBrowserOff } from "@tabler/icons-react";

import { clientApi } from "@homarr/api/client";
import { buildEmbedProxyPath, objectEntries } from "@homarr/common";
import { useI18n } from "@homarr/translation/client";

import type { WidgetComponentProps } from "../definition";
import classes from "./component.module.css";

export default function IFrameWidget({ options, isEditMode }: WidgetComponentProps<"iframe">) {
  const t = useI18n("widget.iframe");
  const { embedUrl, allowScrolling, proxyLogin, ...permissions } = options;
  const trimmedUrl = embedUrl.trim();
  const needsProxyUrl = proxyLogin && trimmedUrl !== "";

  // With login support on, the iframe src must be minted server-side: it carries a
  // signed grant when the proxy runs on a dedicated origin (the client never holds
  // the signing secret). Fetch once and keep it stable — refetching would rotate
  // the grant and reload the frame.
  const embedUrlQuery = clientApi.embed.getUrl.useQuery(
    { url: trimmedUrl },
    {
      enabled: needsProxyUrl,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  );

  const allowedPermissions = getAllowedPermissions(permissions);
  const sandboxFlags = getSandboxFlags(permissions);

  if (trimmedUrl === "") return <NoUrl />;

  // Wait for the minted URL before rendering the frame (avoids a flicker/double
  // load where the frame first loads same-origin, then swaps to the real src).
  if (needsProxyUrl && embedUrlQuery.isLoading) {
    return (
      <Center h="100%" w="100%">
        <Loader />
      </Center>
    );
  }

  // Prefer the server-minted URL; fall back to the same-origin path if the query
  // failed so login support still degrades to single-origin behaviour.
  const resolvedSrc = proxyLogin
    ? (embedUrlQuery.data?.embedUrl ?? buildEmbedProxyPath(embedUrl) ?? embedUrl)
    : embedUrl;

  return (
    <Stack h="100%" w="100%" gap={0}>
      <Box className={classes.frame} style={{ flex: 1, minHeight: 0 }}>
        <iframe
          loading="lazy"
          style={isEditMode ? { userSelect: "none", pointerEvents: "none" } : undefined}
          className={classes.iframe}
          src={resolvedSrc}
          title={getFrameTitle(embedUrl)}
          allow={allowedPermissions}
          scrolling={allowScrolling ? "yes" : "no"}
          sandbox={sandboxFlags.join(" ")}
        >
          <Text>{t("error.noBrowerSupport")}</Text>
        </iframe>
      </Box>
    </Stack>
  );
}

const NoUrl = () => {
  const t = useI18n("widget.iframe");

  return (
    <Stack align="center" justify="center" h="100%">
      <IconBrowserOff />
      <Title order={4}>{t("error.noUrl")}</Title>
    </Stack>
  );
};

export const getAllowedPermissions = (
  permissions: Omit<WidgetComponentProps<"iframe">["options"], "embedUrl" | "allowScrolling" | "proxyLogin">,
) => {
  return (
    objectEntries(permissions)
      // * means it applies to all origins. Sandbox-only flags such as
      // allow-modals intentionally have no Permissions Policy mapping.
      .flatMap(([key, value]) => {
        const permission = permissionMapping[key];
        return value && permission ? [`${permission} *`] : [];
      })
      .join("; ")
  );
};

export const getSandboxFlags = (
  permissions: Omit<WidgetComponentProps<"iframe">["options"], "embedUrl" | "allowScrolling" | "proxyLogin">,
) => {
  const baseSandbox = [
    "allow-scripts",
    "allow-same-origin",
    "allow-forms",
    "allow-popups",
    "allow-top-navigation-by-user-activation",
  ];

  if (permissions.allowFullScreen) {
    baseSandbox.push("allow-presentation");
  }

  if (permissions.allowPayment) {
    baseSandbox.push("allow-popups-to-escape-sandbox");
  }

  if (permissions.allowModals) {
    baseSandbox.push("allow-modals");
  }

  return baseSandbox;
};

const permissionMapping: Partial<
  Record<keyof Omit<WidgetComponentProps<"iframe">["options"], "embedUrl" | "allowScrolling" | "proxyLogin">, string>
> = {
  allowAutoPlay: "autoplay",
  allowCamera: "camera",
  allowFullScreen: "fullscreen",
  allowGeolocation: "geolocation",
  allowMicrophone: "microphone",
  allowPayment: "payment",
};

export const getFrameTitle = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return "iframe";
  }
};
