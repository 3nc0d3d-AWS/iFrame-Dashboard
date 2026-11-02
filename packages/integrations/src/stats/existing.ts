import { withHttpRequestSignalAsync } from "@homarr/core/infrastructure/http";

import type { IntegrationInstanceOfKind } from "../base/creator";
import type { IntegrationKind } from "@homarr/definitions";

import type { IntegrationInput } from "../base/integration";
import { createIntegrationAsync } from "../factory";
import { getUniqueUptimeKumaMonitors, summarizeUptimeKumaMonitors } from "../uptime-kuma/uptime-kuma-summary";
import type { StatsMetric, StatsUnit, StatsValue } from "./types";

export interface ExistingStatsProvider {
  metrics: StatsMetric[];
  fetchAsync: (input: IntegrationInput, signal: AbortSignal) => Promise<Record<string, StatsValue>>;
}

const metric = (key: string, label: string, unit: StatsUnit = "count"): StatsMetric => ({ key, label, unit });

const adapter = <TKind extends IntegrationKind, TData>(
  kind: TKind,
  metrics: StatsMetric[],
  fetchAsync: (client: IntegrationInstanceOfKind<TKind>) => Promise<TData>,
  pick: (data: TData) => Record<string, StatsValue>,
): ExistingStatsProvider => ({
  metrics,
  async fetchAsync(input, signal) {
    return await withHttpRequestSignalAsync(signal, async () => {
      const result = await fetchAsync(await createIntegrationAsync({ ...input, kind }));
      signal.throwIfAborted();
      return pick(result);
    });
  },
});

export const existingStatsProviders: Partial<Record<IntegrationKind, ExistingStatsProvider>> = {
  paperlessNgx: adapter(
    "paperlessNgx",
    [
      metric("documentsTotal", "Documents"),
      metric("documentsInbox", "Inbox"),
      metric("tagsCount", "Tags"),
      metric("correspondentsCount", "Correspondents"),
      metric("documentTypesCount", "Document types"),
    ],
    (client) => client.getStatsAsync(),
    (data) => ({ ...data }),
  ),
  thingport: adapter(
    "thingport",
    [
      metric("modelCount", "Models"),
      metric("collectionCount", "Collections"),
      metric("categoryCount", "Categories"),
      metric("authorCount", "Authors"),
    ],
    (client) => client.getLibraryStatsAsync(),
    ({ modelCount, collectionCount, categoryCount, authorCount }) => ({
      modelCount,
      collectionCount,
      categoryCount,
      authorCount,
    }),
  ),
  navidrome: adapter(
    "navidrome",
    [metric("artistCount", "Artists"), metric("albumCount", "Albums"), metric("songCount", "Songs")],
    (client) => client.getDashboardDataAsync(),
    (data) => ({ ...data }),
  ),
  audiobookshelf: adapter(
    "audiobookshelf",
    [
      metric("libraryCount", "Libraries"),
      metric("totalAudiobooks", "Audiobooks"),
      metric("totalPodcasts", "Podcasts"),
      metric("totalListeningTimeSeconds", "Listening time", "seconds"),
      metric("activeSessions", "Active sessions"),
    ],
    (client) => client.getDashboardDataAsync(),
    ({ libraries: _libraries, ...data }) => data,
  ),
  immich: adapter(
    "immich",
    [
      metric("userCount", "Users"),
      metric("photoCount", "Photos"),
      metric("videoCount", "Videos"),
      metric("totalLibraryUsageInBytes", "Storage", "bytes"),
    ],
    (client) => client.getServerStatsAsync(),
    (data) => ({ ...data }),
  ),
  wud: adapter(
    "wud",
    [metric("totalContainers", "Containers"), metric("updatesAvailable", "Updates available")],
    (client) => client.getStatsAsync(),
    ({ totalContainers, updatesAvailable }) => ({ totalContainers, updatesAvailable }),
  ),
  patchmon: adapter(
    "patchmon",
    [
      metric("totalHosts", "Hosts"),
      metric("hostsNeedingUpdates", "Hosts needing updates"),
      metric("securityUpdates", "Security updates"),
      metric("totalOutdatedPackages", "Outdated packages"),
    ],
    (client) => client.getStatsAsync(),
    ({ totalHosts, hostsNeedingUpdates, securityUpdates, totalOutdatedPackages }) => ({
      totalHosts,
      hostsNeedingUpdates,
      securityUpdates,
      totalOutdatedPackages,
    }),
  ),
  traefik: adapter(
    "traefik",
    [metric("routers", "Routers"), metric("services", "Services"), metric("middlewares", "Middleware")],
    (client) => client.getDashboardDataAsync(),
    ({ http, tcp, udp }) => ({
      routers: http.routers.total + tcp.routers.total + udp.routers.total,
      services: http.services.total + tcp.services.total + udp.services.total,
      middlewares: http.middlewares.total + tcp.middlewares.total,
    }),
  ),
  speedtestTracker: adapter(
    "speedtestTracker",
    [
      metric("ping", "Latency", "milliseconds"),
      metric("download", "Download", "bytesPerSecond"),
      metric("upload", "Upload", "bytesPerSecond"),
    ],
    (client) => client.getLatestResultAsync(),
    (data) => ({
      ping: data?.ping ?? null,
      download: data?.download_bits == null ? null : data.download_bits / 8,
      upload: data?.upload_bits == null ? null : data.upload_bits / 8,
    }),
  ),
};

for (const kind of ["piHole", "adGuardHome", "technitiumDns"] as const) {
  existingStatsProviders[kind] = adapter(
    kind,
    [
      metric("dnsQueriesToday", "Queries today"),
      metric("adsBlockedToday", "Blocked today"),
      metric("adsBlockedTodayPercentage", "Blocked", "percent"),
      metric("domainsBeingBlocked", "Blocked domains"),
    ],
    (client) => client.getSummaryAsync(),
    ({ dnsQueriesToday, adsBlockedToday, adsBlockedTodayPercentage, domainsBeingBlocked }) => ({
      dnsQueriesToday,
      adsBlockedToday,
      adsBlockedTodayPercentage,
      domainsBeingBlocked,
    }),
  );
}
for (const kind of ["dashDot", "glances", "openmediavault", "synology", "truenas", "unraid"] as const) {
  existingStatsProviders[kind] = adapter(
    kind,
    [
      metric("cpu", "CPU", "percent"),
      metric("memoryUsed", "Memory used", "bytes"),
      metric("memoryAvailable", "Memory available", "bytes"),
      metric("uptime", "Uptime", "seconds"),
    ],
    (client) => client.getSystemInfoAsync(),
    (data) => ({
      cpu: data.cpuUtilization,
      memoryUsed: data.memUsedInBytes,
      memoryAvailable: data.memAvailableInBytes,
      uptime: data.uptime,
    }),
  );
}
for (const kind of ["plex", "jellyfin", "emby"] as const) {
  existingStatsProviders[kind] = adapter(
    kind,
    [metric("sessions", "Playback sessions")],
    (client) => client.getCurrentSessionsAsync({ showOnlyPlaying: false }),
    (data) => ({ sessions: data.length }),
  );
}
for (const kind of ["ntfy", "gotify"] as const) {
  existingStatsProviders[kind] = adapter(
    kind,
    [metric("messages", "Retrieved notifications")],
    (client) => client.getNotificationsAsync(),
    (data) => ({ messages: data.length }),
  );
}
existingStatsProviders.nextcloud = adapter(
  "nextcloud",
  [metric("messages", "Retrieved notifications")],
  (client) => client.getNotificationsAsync(),
  (data) => ({ messages: data.length }),
);
existingStatsProviders.gluetun = adapter(
  "gluetun",
  [
    metric("status", "VPN status", "text"),
    metric("publicIp", "Public IP", "text"),
    metric("country", "Country", "text"),
  ],
  (client) => client.getSummaryAsync(),
  (data) => ({ status: data.vpnStatus, publicIp: data.publicIp, country: data.country ?? null }),
);
existingStatsProviders.unifiController = adapter(
  "unifiController",
  [metric("wifi", "Wi-Fi clients"), metric("lan", "Wired clients"), metric("latency", "WAN latency", "milliseconds")],
  (client) => client.getNetworkSummaryAsync(),
  (data) => ({
    wifi: data.wifi.users + data.wifi.guests,
    lan: data.lan.users + data.lan.guests,
    latency: data.www.latency,
  }),
);
existingStatsProviders.peaNut = adapter(
  "peaNut",
  [metric("devices", "UPS devices"), metric("onBattery", "On battery"), metric("lowBattery", "Low battery")],
  (client) => client.getUpsSummariesAsync(),
  (data) => ({
    devices: data.length,
    onBattery: data.filter((item) => item.status === "onBattery").length,
    lowBattery: data.filter((item) => item.status === "lowBattery").length,
  }),
);
existingStatsProviders.uptimeKuma = adapter(
  "uptimeKuma",
  [
    metric("totalMonitors", "Monitors"),
    metric("upCount", "Up"),
    metric("downCount", "Down"),
    metric("pendingCount", "Pending"),
    metric("maintenanceCount", "Maintenance"),
    metric("staleCount", "No recent data"),
    metric("averageUptimePercent", "Average uptime", "percent"),
  ],
  (client) => client.getStatusPageAsync(),
  (statusPage) => {
    const summary = summarizeUptimeKumaMonitors(getUniqueUptimeKumaMonitors(statusPage.groups));
    return {
      totalMonitors: summary.total,
      upCount: summary.counts.up,
      downCount: summary.counts.down,
      pendingCount: summary.counts.pending,
      maintenanceCount: summary.counts.maintenance,
      staleCount: summary.counts.stale,
      averageUptimePercent: summary.averageUptime24h,
    };
  },
);
existingStatsProviders.tdarr = adapter(
  "tdarr",
  [
    metric("totalFileCount", "Files"),
    metric("totalTranscodeCount", "Transcodes"),
    metric("failedTranscodeCount", "Failed transcodes"),
  ],
  (client) => client.getStatisticsAsync(),
  ({ totalFileCount, totalTranscodeCount, failedTranscodeCount }) => ({
    totalFileCount,
    totalTranscodeCount,
    failedTranscodeCount,
  }),
);
existingStatsProviders.coolify = adapter(
  "coolify",
  [metric("applications", "Applications"), metric("services", "Services"), metric("servers", "Servers")],
  (client) => client.getInstanceInfoAsync(),
  (data) => ({ applications: data.applications.length, services: data.services.length, servers: data.servers.length }),
);
existingStatsProviders.proxmox = adapter(
  "proxmox",
  [metric("nodes", "Nodes"), metric("vms", "Virtual machines"), metric("lxcs", "Containers")],
  (client) => client.getClusterInfoAsync(),
  (data) => ({ nodes: data.nodes.length, vms: data.vms.length, lxcs: data.lxcs.length }),
);
existingStatsProviders.beszel = adapter(
  "beszel",
  [metric("systems", "Systems")],
  (client) => client.getSystemsAsync(),
  (data) => ({ systems: data.length }),
);
existingStatsProviders.umami = adapter(
  "umami",
  [metric("websites", "Websites")],
  (client) => client.getWebsitesAsync(),
  (data) => ({ websites: data.length }),
);
existingStatsProviders.opnsense = adapter(
  "opnsense",
  [metric("cpu", "CPU", "percent")],
  (client) => client.getFirewallCpuAsync(),
  (data) => ({ cpu: data.total }),
);
existingStatsProviders.archiveTeamWarrior = adapter(
  "archiveTeamWarrior",
  [metric("running", "Running"), metric("completed", "Completed"), metric("failed", "Failed")],
  (client) => client.getStatusAsync(),
  ({ counts }) => ({ running: counts.running, completed: counts.completed, failed: counts.failed }),
);
existingStatsProviders.llamacpp = adapter(
  "llamacpp",
  [
    metric("health", "Health", "text"),
    metric("tokensGenerated", "Tokens generated"),
    metric("requestsProcessing", "Requests processing"),
  ],
  (client) => client.getStatsAsync(),
  (data) => ({
    health: data.health,
    tokensGenerated: data.metrics.tokensGenerated,
    requestsProcessing: data.metrics.requestsProcessing,
  }),
);
existingStatsProviders.homeAssistant = adapter(
  "homeAssistant",
  [
    metric("entities", "Entities"),
    metric("unavailable", "Unavailable entities"),
    metric("lightsOn", "Lights on"),
    metric("peopleHome", "People home"),
  ],
  (client) => client.getEntityStatsAsync(),
  (data) => data,
);
existingStatsProviders.anchor = adapter(
  "anchor",
  [metric("notes", "Retrieved notes")],
  (client) => client.listNotesAsync(),
  (data) => ({ notes: data.length }),
);
existingStatsProviders.wazuh = adapter(
  "wazuh",
  [
    metric("agents", "Agents"),
    metric("activeAgents", "Active agents"),
    metric("disconnectedAgents", "Disconnected agents"),
    metric("alerts24h", "Alerts (24h)"),
    metric("highAlerts24h", "High alerts (24h)"),
    metric("criticalAlerts24h", "Critical alerts (24h)"),
  ],
  async (client) => {
    const [agents, summary] = await Promise.all([
      client.getAgentsOverviewAsync(),
      // Alert counts need the indexer; agent counts still work with server API credentials only.
      client.getSecuritySummaryAsync({ range: "24h" }).catch(() => null),
    ]);
    return { agents: agents.counts, alerts: summary?.alerts ?? null };
  },
  ({ agents, alerts }) => ({
    agents: agents.total,
    activeAgents: agents.active,
    disconnectedAgents: agents.disconnected,
    alerts24h: alerts?.total ?? null,
    highAlerts24h: alerts?.high ?? null,
    criticalAlerts24h: alerts?.critical ?? null,
  }),
);
existingStatsProviders.mock = {
  metrics: [metric("documents", "Documents"), metric("songs", "Songs"), metric("storage", "Storage", "bytes")],
  async fetchAsync() {
    return { documents: 1234, songs: 5678, storage: 12345678900 };
  },
};
