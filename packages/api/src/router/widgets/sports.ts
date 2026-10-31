import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { env } from "@homarr/common/env";
import { createLogger } from "@homarr/core/infrastructure/logs";

import { createTRPCRouter, publicProcedure } from "../../trpc";

const logger = createLogger({ module: "sportsWidget" });

const TSDB_BASE = "https://www.thesportsdb.com/api/v1/json";
// Shared public test key. Anything else is treated as a user-supplied (premium) key.
const FREE_KEYS = new Set(["", "123", "3"]);

/**
 * Curated catalogue of major leagues with their TheSportsDB league IDs. The free
 * public key cannot list all leagues (it caps `all_leagues.php` to a tiny subset),
 * so this fork ships a hand-verified catalogue that works on the free key. When a
 * user supplies their own (premium) key, {@link getLeaguesRouter} expands the list
 * with the full live catalogue from `all_leagues.php`.
 *
 * IDs marked "verified" were confirmed live against lookupleague.php / eventsday.php.
 */
const LEAGUE_CATALOG: { id: string; label: string; sport: string }[] = [
  { id: "4387", label: "NBA", sport: "Basketball" }, // verified
  { id: "4516", label: "WNBA", sport: "Basketball" }, // verified
  { id: "4391", label: "NFL", sport: "American Football" }, // verified
  { id: "4479", label: "NCAA Football", sport: "American Football" }, // verified
  { id: "4380", label: "NHL", sport: "Ice Hockey" }, // verified
  { id: "4424", label: "MLB", sport: "Baseball" }, // verified
  { id: "4346", label: "MLS", sport: "Soccer" }, // verified
  { id: "4328", label: "English Premier League", sport: "Soccer" }, // verified
  { id: "4335", label: "La Liga", sport: "Soccer" }, // verified
  { id: "4332", label: "Serie A", sport: "Soccer" }, // verified
  { id: "4331", label: "Bundesliga", sport: "Soccer" },
  { id: "4334", label: "Ligue 1", sport: "Soccer" },
  { id: "4337", label: "Eredivisie", sport: "Soccer" },
  { id: "4344", label: "Primeira Liga", sport: "Soccer" },
  { id: "4480", label: "UEFA Champions League", sport: "Soccer" },
  { id: "4481", label: "UEFA Europa League", sport: "Soccer" },
  { id: "4329", label: "EFL Championship", sport: "Soccer" }, // verified (all_leagues)
  { id: "4330", label: "Scottish Premiership", sport: "Soccer" }, // verified (all_leagues)
];

export interface SportsLeagueOption {
  id: string;
  label: string;
  sport: string;
}

export interface SportsEvent {
  id: string;
  league: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  homeBadge: string | null;
  awayBadge: string | null;
  homeScore: string | null;
  awayScore: string | null;
  timestamp: string | null;
  dateLabel: string | null;
  venue: string | null;
  status: string | null;
}

const normalizeKey = (apiKey: string | undefined) => {
  const trimmed = (apiKey ?? "").trim();
  return trimmed.length > 0 ? trimmed : "123";
};

const isPremiumKey = (apiKey: string) => !FREE_KEYS.has(apiKey.trim());

const firstString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
};

interface RawEvent {
  idEvent?: string;
  strEvent?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  strHomeTeamBadge?: string;
  strAwayTeamBadge?: string;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  strTimestamp?: string | null;
  dateEvent?: string | null;
  strTime?: string | null;
  strLeague?: string;
  strSport?: string;
  strVenue?: string | null;
  strStatus?: string | null;
}

const normalizeEvent = (raw: RawEvent): SportsEvent | null => {
  const id = firstString(raw.idEvent);
  const homeTeam = firstString(raw.strHomeTeam);
  const awayTeam = firstString(raw.strAwayTeam);
  if (!id || !homeTeam || !awayTeam) return null;

  const dateLabel =
    raw.dateEvent && raw.strTime ? `${raw.dateEvent} ${raw.strTime.slice(0, 5)}` : firstString(raw.dateEvent);

  return {
    id,
    league: firstString(raw.strLeague) ?? "",
    sport: firstString(raw.strSport) ?? "",
    homeTeam,
    awayTeam,
    homeBadge: firstString(raw.strHomeTeamBadge),
    awayBadge: firstString(raw.strAwayTeamBadge),
    homeScore: firstString(raw.intHomeScore),
    awayScore: firstString(raw.intAwayScore),
    timestamp: firstString(raw.strTimestamp),
    dateLabel,
    venue: firstString(raw.strVenue),
    status: firstString(raw.strStatus),
  };
};

// Module-level cache keyed by apiKey:leagueId:date. Events are cached so repeated
// widget renders and multiple boards do not re-hit the API. On a failed fetch
// (including Cloudflare's aggressive "1015" rate limiting on the free key) the
// last good payload is served stale, so the widget keeps working under throttling.
const CACHE_TTL_MS = 120_000;
const eventCache = new Map<string, { events: SportsEvent[]; fetchedAt: number }>();

const fetchLeagueDayAsync = async (apiKey: string, leagueId: string, date: string): Promise<SportsEvent[]> => {
  const cacheKey = `${apiKey}:${leagueId}:${date}`;
  const cached = eventCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.events;

  try {
    const url = `${TSDB_BASE}/${encodeURIComponent(apiKey)}/eventsday.php?d=${encodeURIComponent(date)}&l=${encodeURIComponent(leagueId)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    const text = await response.text();
    // The free tier is fronted by Cloudflare, which returns a non-JSON "error code: 1015"
    // body instead of an HTTP error when throttling.
    if (!response.ok || text.includes("error code:")) {
      throw new Error(`TheSportsDB responded with status ${response.status}`);
    }
    const json = JSON.parse(text) as { events?: RawEvent[] | null };
    const events = (json.events ?? []).map(normalizeEvent).filter((event): event is SportsEvent => event !== null);
    eventCache.set(cacheKey, { events, fetchedAt: Date.now() });
    return events;
  } catch (error) {
    if (cached) {
      logger.warn("Serving stale sports events after fetch failure", {
        leagueId,
        date,
        errorType: error instanceof Error ? error.name : typeof error,
      });
      return cached.events;
    }
    throw error;
  }
};

export const sportsRouter = createTRPCRouter({
  getLeagues: publicProcedure
    .input(z.object({ apiKey: z.string().optional() }))
    .query(async ({ input }): Promise<SportsLeagueOption[]> => {
      const apiKey = normalizeKey(input.apiKey);
      if (env.NO_EXTERNAL_CONNECTION || !isPremiumKey(apiKey)) return LEAGUE_CATALOG;

      try {
        const response = await fetch(`${TSDB_BASE}/${encodeURIComponent(apiKey)}/all_leagues.php`, {
          signal: AbortSignal.timeout(8_000),
        });
        const text = await response.text();
        if (!response.ok || text.includes("error code:")) {
          throw new Error(`TheSportsDB responded with status ${response.status}`);
        }
        const json = JSON.parse(text) as {
          leagues?: { idLeague?: string; strLeague?: string; strSport?: string }[] | null;
        };
        const live = (json.leagues ?? [])
          .map((league) => ({
            id: firstString(league.idLeague) ?? "",
            label: firstString(league.strLeague) ?? "",
            sport: firstString(league.strSport) ?? "",
          }))
          .filter((league) => league.id && league.label);

        // Keep the curated entries first, then append any live leagues not already covered.
        const seen = new Set(LEAGUE_CATALOG.map((league) => league.id));
        const merged = [...LEAGUE_CATALOG];
        for (const league of live) {
          if (seen.has(league.id)) continue;
          seen.add(league.id);
          merged.push(league);
        }
        return merged;
      } catch (error) {
        logger.warn("Failed to load premium league list, falling back to catalogue", {
          errorType: error instanceof Error ? error.name : typeof error,
        });
        return LEAGUE_CATALOG;
      }
    }),

  getEvents: publicProcedure
    .input(
      z.object({
        leagueIds: z.array(z.string()).max(60),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        apiKey: z.string().optional(),
      }),
    )
    .query(async ({ input }): Promise<{ events: SportsEvent[]; failedLeagueCount: number }> => {
      if (env.NO_EXTERNAL_CONNECTION || input.leagueIds.length === 0) {
        return { events: [], failedLeagueCount: 0 };
      }
      const apiKey = normalizeKey(input.apiKey);

      const settled = await Promise.allSettled(
        input.leagueIds.map((leagueId) => fetchLeagueDayAsync(apiKey, leagueId, input.date)),
      );

      const failedLeagueCount = settled.filter((result) => result.status === "rejected").length;

      // Every selected league failed and nothing was cached: surface a hard error so the
      // widget shows its retryable error state instead of a misleading "no events today".
      if (failedLeagueCount === settled.length) {
        throw new TRPCError({ code: "BAD_GATEWAY", message: "All sports league requests failed" });
      }

      const byId = new Map<string, SportsEvent>();
      for (const result of settled) {
        if (result.status !== "fulfilled") continue;
        for (const event of result.value) byId.set(event.id, event);
      }

      const events = [...byId.values()].toSorted((a, b) => {
        if (a.timestamp && b.timestamp) return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        if (a.timestamp) return -1;
        if (b.timestamp) return 1;
        return 0;
      });

      return { events, failedLeagueCount };
    }),
});
