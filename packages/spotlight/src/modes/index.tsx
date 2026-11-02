import { appIntegrationBoardMode } from "./app-integration-board";
import { assistantMode } from "./assistant";
import { commandMode } from "./command";
import { externalMode } from "./external";
import { homeMode } from "./home";
import { preferencesMode } from "./preferences";
import { userGroupMode } from "./user-group";

export const searchModes = [
  homeMode,
  appIntegrationBoardMode,
  commandMode,
  preferencesMode,
  assistantMode,
  externalMode,
  userGroupMode,
] as const;
