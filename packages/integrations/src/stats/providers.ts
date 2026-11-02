import type { StatsProvider } from "./types";
import { caddyStatsProvider } from "./providers/caddy";
import { changedetectionStatsProvider } from "./providers/changedetection";
import { fileflowsStatsProvider } from "./providers/fileflows";
import { gatusStatsProvider } from "./providers/gatus";
import { healthchecksStatsProvider } from "./providers/healthchecks";
import { homeboxStatsProvider } from "./providers/homebox";
import { jellystatStatsProvider } from "./providers/jellystat";
import { karakeepStatsProvider } from "./providers/karakeep";
import { komgaStatsProvider } from "./providers/komga";
import { linkwardenStatsProvider } from "./providers/linkwarden";
import { mealieStatsProvider } from "./providers/mealie";
import { minifluxStatsProvider } from "./providers/miniflux";
import { netdataStatsProvider } from "./providers/netdata";
import { netalertxStatsProvider } from "./providers/netalertx";
import { frigateStatsProvider } from "./providers/frigate";
import { scrutinyStatsProvider } from "./providers/scrutiny";
import { plantitStatsProvider } from "./providers/plantit";
import { prometheusStatsProvider } from "./providers/prometheus";
import { spoolmanStatsProvider } from "./providers/spoolman";
import { syncthingRelayStatsProvider } from "./providers/syncthing-relay";
import { tandoorStatsProvider } from "./providers/tandoor";
import { triliumStatsProvider } from "./providers/trilium";
import { unmanicStatsProvider } from "./providers/unmanic";
import { yourSpotifyStatsProvider } from "./providers/your-spotify";

export const statsProviders = {
  caddy: caddyStatsProvider,
  changedetection: changedetectionStatsProvider,
  fileflows: fileflowsStatsProvider,
  gatus: gatusStatsProvider,
  healthchecks: healthchecksStatsProvider,
  homebox: homeboxStatsProvider,
  jellystat: jellystatStatsProvider,
  karakeep: karakeepStatsProvider,
  komga: komgaStatsProvider,
  linkwarden: linkwardenStatsProvider,
  mealie: mealieStatsProvider,
  miniflux: minifluxStatsProvider,
  netdata: netdataStatsProvider,
  netalertx: netalertxStatsProvider,
  frigate: frigateStatsProvider,
  scrutiny: scrutinyStatsProvider,
  plantit: plantitStatsProvider,
  prometheus: prometheusStatsProvider,
  spoolman: spoolmanStatsProvider,
  syncthingRelay: syncthingRelayStatsProvider,
  tandoor: tandoorStatsProvider,
  trilium: triliumStatsProvider,
  unmanic: unmanicStatsProvider,
  yourSpotify: yourSpotifyStatsProvider,
} satisfies Record<string, StatsProvider>;
