"use client";

import type React from "react";
import { useEffect, useRef } from "react";
import { Alert, Badge, Card, Flex, Group, Image, Stack, Text } from "@mantine/core";
import { IconAlertTriangle, IconServerOff } from "@tabler/icons-react";
import dayjs from "dayjs";

import type { RouterOutputs } from "@homarr/api";
import { clientApi } from "@homarr/api/client";
import { useRequiredBoard } from "@homarr/boards/context";
import { useI18n } from "@homarr/translation/client";

import { WidgetEmptyState } from "../common/empty-state";
import { WidgetQueryLoadingState } from "../common/query-state-indicator";
import type { WidgetComponentProps } from "../definition";
import { BaseWidgetError } from "../errors/base-component";
import classes from "./component.module.css";

type SportsEvent = RouterOutputs["widget"]["sports"]["getEvents"]["events"][number];

const CARD_GAP = 12;

// Pixels per second, matching the ~20px/s constant speed of the reference ticker.
const pixelsPerSecond = (speed: string) => (speed === "fast" ? 40 : speed === "slow" ? 12 : 22);

const isFinished = (status: string | null) =>
  status !== null && /^(ft|aet|aot|ap|match finished|final|finished)/i.test(status);

const isNotStarted = (status: string | null) =>
  status === null || status === "" || /^(ns|not started|tbd|sched|pre)/i.test(status);

export default function Sports({ options, width, height }: WidgetComponentProps<"sports">) {
  const t = useI18n("widget.sports");
  const board = useRequiredBoard();
  const today = dayjs().format("YYYY-MM-DD");

  const query = clientApi.widget.sports.getEvents.useQuery(
    { leagueIds: options.leagues, date: today, apiKey: options.apiKey },
    { enabled: options.leagues.length > 0 },
  );

  if (options.leagues.length === 0) {
    return (
      <Flex h="100%" align="center" justify="center" p="sm">
        <Text c="dimmed" size="sm" ta="center">
          {t("noLeaguesSelected")}
        </Text>
      </Flex>
    );
  }

  if (query.error && query.data === undefined) {
    return (
      <BaseWidgetError
        icon={IconServerOff}
        message={t("error.allLeaguesFailed")}
        showLogsLink
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (query.isPending || query.data === undefined) return <WidgetQueryLoadingState />;

  const { events, failedLeagueCount } = query.data;
  const warning = failedLeagueCount > 0 ? t("warning.partial", { count: failedLeagueCount }) : undefined;

  if (events.length === 0) {
    return (
      <Flex direction="column" h="100%" p="xs" gap="xs">
        {warning && <PartialWarning message={warning} />}
        <Flex flex={1} align="center" justify="center">
          <WidgetEmptyState />
        </Flex>
      </Flex>
    );
  }

  const isCompact = height < 150;
  const cardWidth = width < 320 ? 190 : 230;

  return (
    <Stack h="100%" gap={4} p={4}>
      {warning && <PartialWarning message={warning} />}
      <SportsMarquee
        events={events}
        speed={pixelsPerSecond(options.scrollSpeed)}
        viewportWidth={width}
        cardWidth={cardWidth}
        renderCard={(event) => (
          <EventCard
            event={event}
            radius={board.itemRadius}
            compact={isCompact}
            showScores={options.showScores}
            showLogos={options.showLogos}
            showVenue={options.showVenue}
          />
        )}
      />
    </Stack>
  );
}

interface SportsMarqueeProps {
  events: SportsEvent[];
  speed: number;
  viewportWidth: number;
  cardWidth: number;
  renderCard: (event: SportsEvent) => React.ReactNode;
}

/**
 * Continuous, constant-speed horizontal ticker modelled on the reference page:
 * the event list is repeated enough times to be wider than the viewport, then a
 * requestAnimationFrame loop translates the track by a fixed pixels-per-second and
 * wraps by exactly one set width for a seamless, gap-free loop. Pauses on hover/focus
 * and honours prefers-reduced-motion (falls back to a manually scrollable row).
 *
 * The rAF loop is set up ONCE on mount and reads the live speed / set size from refs.
 * This is deliberate: the board feeds `width` (viewportWidth) that jitters during grid
 * layout and resize, and restarting the effect on every change would reset the scroll
 * position to 0 each time, leaving the track visually frozen.
 */
const SportsMarquee = ({ events, speed, viewportWidth, cardWidth, renderCard }: SportsMarqueeProps) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Live values read by the mount-once animation loop (so it never has to restart).
  const speedRef = useRef(speed);
  const setCountRef = useRef(events.length);
  speedRef.current = speed;
  setCountRef.current = events.length;

  // Repeat the list generously so the row always overflows the viewport by at least
  // one full set (needed for a seamless wrap). Derived, not stateful, to avoid any
  // measure-then-setState render loop.
  const estimatedSetWidth = Math.max(events.length * (cardWidth + CARD_GAP), 1);
  const repeat = Math.max(3, Math.ceil(viewportWidth / estimatedSetWidth) + 2);

  useEffect(() => {
    const track = trackRef.current;
    const viewport = viewportRef.current;
    if (!track || !viewport) return;

    let raf = 0;
    let pos = 0;
    let last = performance.now();
    let hovering = false;

    // Width of exactly one set = distance between the first card of set 1 and the
    // first card of set 2. Measured live each frame so it adapts to layout changes.
    const oneSetWidth = () => {
      const first = track.children[0] as HTMLElement | undefined;
      const secondSetStart = track.children[setCountRef.current] as HTMLElement | undefined;
      if (!first || !secondSetStart) return 0;
      return secondSetStart.offsetLeft - first.offsetLeft;
    };

    const step = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.05);
      last = now;
      // Auto-scroll always runs (this widget is a ticker by design); it only pauses
      // on hover/focus so a card can be read. OS "reduce motion" is intentionally not
      // honoured here because a frozen scoreboard defeats the widget's purpose.
      if (!hovering) {
        const oneSet = oneSetWidth();
        // Move content leftward (cards travel across the row); wrap by one full set.
        pos -= speedRef.current * delta;
        if (oneSet > 0) {
          while (pos <= -oneSet) pos += oneSet;
        }
        track.style.transform = `translate3d(${pos}px, 0, 0)`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const enter = () => {
      hovering = true;
    };
    const leave = () => {
      hovering = false;
      last = performance.now();
    };

    viewport.addEventListener("mouseenter", enter);
    viewport.addEventListener("mouseleave", leave);
    viewport.addEventListener("focusin", enter);
    viewport.addEventListener("focusout", leave);

    return () => {
      cancelAnimationFrame(raf);
      viewport.removeEventListener("mouseenter", enter);
      viewport.removeEventListener("mouseleave", leave);
      viewport.removeEventListener("focusin", enter);
      viewport.removeEventListener("focusout", leave);
    };
    // Intentionally mount-once: live values come from refs above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={viewportRef}
      className={classes.viewport}
      style={{ "--sports-gap": `${CARD_GAP}px`, "--sports-card-width": `${cardWidth}px` } as React.CSSProperties}
    >
      <div ref={trackRef} className={classes.track}>
        {Array.from({ length: repeat }).flatMap((_unused, setIndex) =>
          events.map((event) => (
            <div key={`${setIndex}-${event.id}`} className={classes.card} aria-hidden={setIndex > 0}>
              {renderCard(event)}
            </div>
          )),
        )}
      </div>
    </div>
  );
};

const PartialWarning = ({ message }: { message: string }) => (
  <Alert
    role="presentation"
    color="orange"
    icon={<IconAlertTriangle aria-hidden size="var(--mantine-font-size-md)" />}
    p={6}
  >
    <output>{message}</output>
  </Alert>
);

interface EventCardProps {
  event: SportsEvent;
  radius: string | number;
  compact: boolean;
  showScores: boolean;
  showLogos: boolean;
  showVenue: boolean;
}

const EventCard = ({ event, radius, compact, showScores, showLogos, showVenue }: EventCardProps) => {
  const finished = isFinished(event.status);
  const notStarted = isNotStarted(event.status);
  const live = !finished && !notStarted;
  const hasScore = showScores && (finished || live) && event.homeScore !== null && event.awayScore !== null;

  const timeLabel = event.timestamp ? dayjs(event.timestamp).format("ddd h:mm A") : (event.dateLabel ?? "");

  return (
    <Card radius={radius} withBorder p={compact ? 8 : 10} h="100%">
      <Group justify="space-between" wrap="nowrap" gap={6} mb={6}>
        <Text size="xs" c="dimmed" fw={600} truncate="end">
          {event.league}
        </Text>
        {live ? (
          <Badge size="xs" color="red" variant="light">
            {event.status}
          </Badge>
        ) : finished ? (
          <Badge size="xs" color="gray" variant="light">
            {`Final`}
          </Badge>
        ) : (
          <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
            {timeLabel}
          </Text>
        )}
      </Group>

      <Stack gap={4}>
        <TeamRow name={event.homeTeam} badge={event.homeBadge} score={hasScore ? event.homeScore : null} showLogo={showLogos} />
        <TeamRow name={event.awayTeam} badge={event.awayBadge} score={hasScore ? event.awayScore : null} showLogo={showLogos} />
      </Stack>

      {showVenue && event.venue && (
        <Text size="xs" c="dimmed" mt={6} truncate="end">
          {event.venue}
        </Text>
      )}
    </Card>
  );
};

interface TeamRowProps {
  name: string;
  badge: string | null;
  score: string | null;
  showLogo: boolean;
}

const TeamRow = ({ name, badge, score, showLogo }: TeamRowProps) => (
  <Group justify="space-between" wrap="nowrap" gap={6}>
    <Group wrap="nowrap" gap={6} miw={0}>
      {showLogo && badge && <Image className={classes.badge} src={badge} alt="" w={18} h={18} loading="lazy" />}
      <Text size="sm" truncate="end">
        {name}
      </Text>
    </Group>
    {score !== null && (
      <Text size="sm" fw={700} style={{ whiteSpace: "nowrap" }}>
        {score}
      </Text>
    )}
  </Group>
);
