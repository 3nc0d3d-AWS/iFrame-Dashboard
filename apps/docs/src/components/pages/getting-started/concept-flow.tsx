import type { ReactNode } from "react";

import Link from "next/link";
import { IconCalendar, IconDownload, IconPlugConnected } from "@tabler/icons-react";

import { jellyfinIntegration } from "@site/docs/integrations/jellyfin";
import { plexIntegration } from "@site/docs/integrations/plex";
import { FlowConnector } from "@site/src/components/ui/flow-connector";

import styles from "./concept-flow.module.css";

const services = [
  {
    name: jellyfinIntegration.name,
    iconUrl: getIconUrl(jellyfinIntegration.iconUrl),
    endpoint: "jellyfin:8096",
    href: "/docs/integrations/jellyfin",
  },
  {
    name: plexIntegration.name,
    iconUrl: getIconUrl(plexIntegration.iconUrl),
    endpoint: "plex:32400",
    href: "/docs/integrations/plex",
  },
];

const widgets = [
  {
    name: "Calendar",
    icon: IconCalendar,
    href: "/docs/widgets/calendar",
  },
  {
    name: "Media Server",
    icon: IconDownload,
    href: "/docs/widgets/media-server",
  },
];

const calendarDays = Array.from({ length: 14 }, (_, index) => index + 1);
const calendarEventDays = new Set([3, 8, 12]);

function getIconUrl(iconUrl: typeof jellyfinIntegration.iconUrl) {
  if (typeof iconUrl === "string") return iconUrl;
  return iconUrl.light;
}

export function ConceptFlow() {
  return (
    <figure className={styles.diagram} aria-label="How Homarr connects services to a board">
      <div className={styles.lane}>
        <Stage number="1" title="Service" detail="API endpoint">
          <div className={styles.serviceList}>
            {services.map((service) => (
              <Link className={styles.service} href={service.href} key={service.name}>
                <img src={service.iconUrl} alt="" />
                <span>
                  <strong>{service.name}</strong>
                  <code>{service.endpoint}</code>
                </span>
              </Link>
            ))}
          </div>
        </Stage>

        <FlowConnector />

        <Stage number="2" title="Integration" detail="Server-side connection" href="/docs/management/integrations">
          <div className={styles.integration}>
            <IconPlugConnected size={26} aria-hidden="true" />
            <code>URL + credentials</code>
            <span>Fetch data and run actions</span>
          </div>
        </Stage>

        <FlowConnector animationDelay={350} />

        <Stage number="3" title="Widget" detail="Data and actions" href="/docs/widgets">
          <div className={styles.widgetList}>
            {widgets.map((widget) => {
              const Icon = widget.icon;
              return (
                <Link className={styles.widget} href={widget.href} key={widget.name}>
                  <Icon size={17} aria-hidden="true" />
                  <span>{widget.name}</span>
                </Link>
              );
            })}
          </div>
        </Stage>

        <FlowConnector animationDelay={700} />

        <Stage number="4" title="Board" detail="Placed in the grid" href="/docs/management/boards">
          <div className={styles.boardCalendar} aria-hidden="true">
            <div className={styles.calendarHeader}>
              <strong>September</strong>
              <span>3 events</span>
            </div>
            <div className={styles.calendarWeekdays}>
              {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                <span key={`${day}-${index}`}>{day}</span>
              ))}
            </div>
            <div className={styles.calendarDays}>
              {calendarDays.map((day) => (
                <span data-event={calendarEventDays.has(day) || undefined} key={day}>
                  {day}
                </span>
              ))}
            </div>
          </div>
        </Stage>
      </div>
    </figure>
  );
}

function Stage({
  number,
  title,
  detail,
  href,
  children,
}: {
  number: string;
  title: string;
  detail: string;
  href?: string;
  children?: ReactNode;
}) {
  const heading = (
    <>
      <span className={styles.stageNumber}>{number}</span>
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
    </>
  );

  return (
    <section className={styles.stage}>
      {href ? (
        <Link className={styles.stageHeading} href={href}>
          {heading}
        </Link>
      ) : (
        <div className={styles.stageHeading}>{heading}</div>
      )}
      {children}
    </section>
  );
}
