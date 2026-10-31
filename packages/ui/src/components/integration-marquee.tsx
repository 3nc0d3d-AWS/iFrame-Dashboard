import { Image, Marquee, SimpleGrid } from "@mantine/core";

import { splitToNChunks } from "@homarr/common";

import classes from "./integration-marquee.module.css";

// Curated set of mainstream, brand-neutral app icons for the onboarding backdrop.
// Whitelabel on purpose: recognizable to anyone, promoting no particular stack.
const marqueeIconSlugs = [
  "google",
  "gmail",
  "google-calendar",
  "google-drive",
  "google-maps",
  "chrome",
  "slack",
  "discord",
  "notion",
  "figma",
  "spotify",
  "github",
  "visual-studio-code",
  "microsoft",
  "apple",
  "android",
  "facebook",
  "x",
  "youtube",
  "dropbox",
  "telegram",
  "whatsapp",
  "zoom",
  "linkedin",
];

const iconGroups = splitToNChunks(
  marqueeIconSlugs.map((slug) => `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${slug}.svg`),
  3,
);
const animationDuration = iconGroups.flat().length * 2;

export const IntegrationMarquee = ({ className }: { className?: string }) => (
  <SimpleGrid
    className={className}
    cols={3}
    spacing="xl"
    h="calc(100% + 6rem)"
    my="-3rem"
    style={{ transform: "rotate(10deg)" }}
    aria-hidden
  >
    {iconGroups.map((icons, columnIndex) => (
      <Marquee
        key={columnIndex}
        orientation="vertical"
        repeat={2}
        duration={(animationDuration - columnIndex * 3) * 1000}
        gap="xl"
        fadeEdges={false}
        h="100%"
        className={classes.marquee}
        classNames={{ content: classes.content }}
      >
        {icons.map((icon) => (
          <Image key={`${icon}-${columnIndex}`} src={icon} alt="" fit="contain" w={52} h={52} />
        ))}
      </Marquee>
    ))}
  </SimpleGrid>
);
