import { createKeyedFingerprint, verifyKeyedFingerprint } from "./encryption";

/**
 * Signed grant tokens for the iframe login proxy when it runs on a dedicated
 * origin (EMBED_PROXY_ORIGIN). The panel session cookie is host-scoped and never
 * reaches that origin, so the embed route can't use auth() there. Instead the
 * panel mints a short-lived token proving an authenticated user asked to embed;
 * the embed route verifies it and bootstraps its own scoped session cookie.
 *
 * The token is HMAC-signed with the server's SECRET_ENCRYPTION_KEY (via the
 * keyed-fingerprint helpers) — it is server-only and never exposed to the client
 * as a secret (the client only ever receives a ready-made URL carrying it).
 */

const tokenNamespace = "embed-proxy-v1:";

interface EmbedTokenPayload {
  /** User id the grant belongs to. */
  uid: string;
  /** Expiry, epoch milliseconds. */
  exp: number;
}

const encodePayload = (payload: EmbedTokenPayload): string =>
  Buffer.from(JSON.stringify(payload)).toString("base64url");

const decodePayload = (encoded: string): EmbedTokenPayload | null => {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as EmbedTokenPayload).uid === "string" &&
      typeof (parsed as EmbedTokenPayload).exp === "number"
    ) {
      return parsed as EmbedTokenPayload;
    }
  } catch {
    // fall through
  }
  return null;
};

/** Signs an embed grant for `userId` valid for `ttlMs` from now. */
export const signEmbedToken = (userId: string, ttlMs: number): string => {
  const payload = encodePayload({ uid: userId, exp: Date.now() + ttlMs });
  const signature = createKeyedFingerprint(`${tokenNamespace}${payload}`);
  return `${payload}.${signature}`;
};

/** Verifies an embed grant; returns the user id when valid and unexpired, else null. */
export const verifyEmbedToken = (token: string): { userId: string } | null => {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (!verifyKeyedFingerprint(`${tokenNamespace}${payload}`, signature)) return null;

  const data = decodePayload(payload);
  if (!data) return null;
  if (Date.now() > data.exp) return null;

  return { userId: data.uid };
};
