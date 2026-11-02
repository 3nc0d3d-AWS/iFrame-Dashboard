export const mediaReleaseTypes = ["inCinemas", "digitalRelease", "physicalRelease"] as const;
export type MediaReleaseType = (typeof mediaReleaseTypes)[number];

export interface MediaReleaseMetadata {
  type: "mediaRelease";
  releaseType: MediaReleaseType;
}

export type CalendarMetadata = MediaReleaseMetadata;

export interface CalendarLink {
  name: string;
  isDark: boolean;
  href: string;
  color?: string;
  logo?: string;
}

export interface CalendarImageBadge {
  content: string;
  color: string;
}

export interface CalendarImage {
  src: string;
  badge?: CalendarImageBadge;
  aspectRatio?: { width: number; height: number };
}

export interface CalendarEvent {
  title: string;
  subTitle: string | null;
  description: string | null;
  startDate: Date;
  endDate: Date | null;
  image: CalendarImage | null;
  location: string | null;
  metadata?: CalendarMetadata;
  indicatorColor: string;
  links: CalendarLink[];
}
