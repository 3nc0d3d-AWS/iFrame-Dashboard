ALTER TABLE "user" ADD COLUMN "header_preferences" text DEFAULT '{"version":3,"visible":true,"searchDisplay":"input","logoDisplay":"logoAndText","zones":{"left":[{"type":"builtin","id":"logo"}],"center":[{"type":"builtin","id":"search"}],"right":[{"type":"builtin","id":"boardEdit"},{"type":"builtin","id":"boardSettings"},{"type":"builtin","id":"user"}]}}' NOT NULL;
--> statement-breakpoint
INSERT INTO "serverSetting" ("setting_key", "value")
VALUES ('branding', '{"json":{"appName":"iFrame","greeting":"","logoImageUrl":null,"faviconImageUrl":null,"primaryColor":"#4080d0","secondaryColor":"#e8893b","lockPrimaryColor":false,"signInBackgroundImageUrl":null,"signInBackgroundOverlay":0.55,"authBranding":{"showAppName":true,"showLogo":true,"showGreeting":true},"defaultRadius":"md"}}')
ON CONFLICT ("setting_key") DO NOTHING;
