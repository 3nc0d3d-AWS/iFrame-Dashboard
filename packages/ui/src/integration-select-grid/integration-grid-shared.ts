import type { IntegrationKind, WidgetKind } from "@homarr/definitions";
import {
  getIntegrationName,
  getIntegrationOnboardingMetadata,
  getWidgetKindsForIntegration,
  integrationDefs,
  integrationKinds,
} from "@homarr/definitions";

export const categoryTranslationKeys: Record<string, string> = {
  dnsHole: "integration.category.dnsHole",
  mediaService: "integration.category.mediaService",
  calendar: "integration.category.calendar",
  mediaSearch: "integration.category.mediaSearch",
  mediaRelease: "integration.category.mediaRelease",
  mediaRequest: "integration.category.mediaRequest",
  downloadClient: "integration.category.downloadClient",
  usenet: "integration.category.usenet",
  torrent: "integration.category.torrent",
  miscellaneous: "integration.category.miscellaneous",
  smartHomeServer: "integration.category.smartHomeServer",
  indexerManager: "integration.category.indexerManager",
  healthMonitoring: "integration.category.healthMonitoring",
  beszel: "integration.category.beszel",
  search: "integration.category.search",
  mediaTranscoding: "integration.category.mediaTranscoding",
  networkController: "integration.category.networkController",
  notifications: "integration.category.notifications",
  firewall: "integration.category.firewall",
  photoService: "integration.category.photoService",
  notes: "integration.category.notes",
  mediaMonitoring: "integration.category.mediaMonitoring",
  speedtest: "integration.category.speedtest",
  analytics: "integration.category.analytics",
  vpn: "integration.category.vpn",
  documents: "integration.category.documents",
  mediaLibrary: "integration.category.mediaLibrary",
  uptimeMonitoring: "integration.category.uptimeMonitoring",
  serviceVersion: "integration.category.serviceVersion",
};

export interface IntegrationGridItem {
  kind: IntegrationKind;
  name: string;
  categories: string[];
  widgets: WidgetKind[];
}

// Integrations hidden from every picker to keep the product clean and whitelabel:
// the *arr automation suite, torrent/usenet/P2P download clients, indexers and
// media-request tools (piracy-adjacent), plus NSFW / IPTV-proxy / ROM / media-ripping
// apps. Legitimate self-hosting stays (NAS, smart home, DNS, monitoring, media servers,
// photos, documents, networking, etc.).
export const blockedIntegrationKinds = new Set<IntegrationKind>([
  "autobrr",
  "sabNzbd",
  "nzbGet",
  "deluge",
  "transmission",
  "qBittorrent",
  "aria2",
  "slskd",
  "jackett",
  "prowlarr",
  "sonarr",
  "sportarr",
  "radarr",
  "lidarr",
  "readarr",
  "bindery",
  "bazarr",
  "jellyseerr",
  "seerr",
  "overseerr",
  "tracearr",
  "maintainerr",
  "stash",
  "xteve",
  "romm",
  "tubearchivist",
]);

export const buildSortedIntegrations = (
  options: {
    enableMockIntegration?: boolean;
    onboarding?: boolean;
    allowedKinds?: readonly IntegrationKind[];
  } = {},
): IntegrationGridItem[] =>
  integrationKinds
    .filter((kind) => {
      if (blockedIntegrationKinds.has(kind)) return false;
      if (options.allowedKinds && !options.allowedKinds.includes(kind)) return false;
      if (options.onboarding && getIntegrationOnboardingMetadata(kind).hidden) return false;
      if (!options.enableMockIntegration && kind === "mock") return false;
      return true;
    })
    .map((kind) => ({
      kind,
      name: getIntegrationName(kind),
      categories: [...new Set(integrationDefs[kind].category.flat())] as string[],
      widgets: getWidgetKindsForIntegration(kind),
    }))
    .toSorted((left, right) => {
      const leftFeaturedOrder = getIntegrationOnboardingMetadata(left.kind).featuredOrder;
      const rightFeaturedOrder = getIntegrationOnboardingMetadata(right.kind).featuredOrder;
      if (leftFeaturedOrder !== null && rightFeaturedOrder !== null) return leftFeaturedOrder - rightFeaturedOrder;
      if (leftFeaturedOrder !== null) return -1;
      if (rightFeaturedOrder !== null) return 1;
      return right.widgets.length - left.widgets.length || left.name.localeCompare(right.name);
    });

export const filterIntegrations = (items: IntegrationGridItem[], search: string) => {
  const query = search.toLocaleLowerCase().trim();
  if (!query) return items;
  return items.filter((item) => item.name.toLocaleLowerCase().includes(query));
};
