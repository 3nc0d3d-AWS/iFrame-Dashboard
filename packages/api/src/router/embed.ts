import { z } from "zod/v4";

import { buildEmbedProxyPath, embedGrantParam, embedGrantTtlMs } from "@homarr/common";
import { env } from "@homarr/common/env";
import { signEmbedToken } from "@homarr/common/server";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const embedRouter = createTRPCRouter({
  /**
   * Resolves a target URL to the URL the iframe should actually load for login
   * support. In single-origin mode it's a same-origin relative path (gated by the
   * panel session). When EMBED_PROXY_ORIGIN is set, it's an absolute URL on that
   * dedicated origin carrying a short-lived signed grant — minted here, server-side,
   * for the authenticated user, since the client must never hold the signing secret.
   */
  getUrl: protectedProcedure
    .input(z.object({ url: z.string() }))
    .query(({ input, ctx }): { embedUrl: string | null } => {
      const path = buildEmbedProxyPath(input.url);
      if (!path) return { embedUrl: null };

      const origin = env.EMBED_PROXY_ORIGIN;
      if (!origin) {
        // Single-origin: same-origin relative path, authorized by the panel session.
        return { embedUrl: path };
      }

      const token = signEmbedToken(ctx.session.user.id, embedGrantTtlMs);
      const separator = path.includes("?") ? "&" : "?";
      return { embedUrl: `${origin}${path}${separator}${embedGrantParam}=${encodeURIComponent(token)}` };
    }),
});
