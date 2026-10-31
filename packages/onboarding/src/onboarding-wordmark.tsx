"use client";

import { useState } from "react";
import confetti from "canvas-confetti";

import classes from "./onboarding-studio.module.css";
import { useOnboardingSounds } from "./use-onboarding-sounds";

interface OnboardingWordmarkProps {
  appName?: string;
  logoImageUrl?: string;
  showAppName?: boolean;
  showAppLogo?: boolean;
  primaryColor?: string;
  secondaryColor?: string;
  large?: boolean;
}

export const OnboardingWordmark = ({
  appName,
  logoImageUrl,
  showAppName,
  showAppLogo,
  primaryColor,
  secondaryColor,
  large = false,
}: OnboardingWordmarkProps) => {
  const [celebrating, setCelebrating] = useState(false);
  const sounds = useOnboardingSounds();

  const resolvedAppName = appName?.trim() || "iFrame";

  const celebrate = (logoElement: Element) => {
    sounds.hover();
    const logo = logoElement.getBoundingClientRect();
    const originY = (logo.top + logo.height / 2) / window.innerHeight;
    const confettiColors = primaryColor && secondaryColor ? [primaryColor, secondaryColor] : undefined;

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setCelebrating(true);
    for (const { angle, originX } of [
      { angle: 165, originX: logo.left + logo.width * 0.12 },
      { angle: 15, originX: logo.right - logo.width * 0.12 },
    ]) {
      void confetti({
        particleCount: 28,
        angle,
        spread: 35,
        startVelocity: 14,
        gravity: 0.7,
        ticks: 90,
        scalar: 0.8,
        origin: { x: originX / window.innerWidth, y: originY },
        colors: confettiColors,
        disableForReducedMotion: true,
      });
    }
  };

  // When explicit visibility controls are provided (the auth shell), honor them;
  // otherwise (the welcome and finish screens) show both the logo and the app name.
  const hasVisibilityControls = showAppName !== undefined || showAppLogo !== undefined;
  const renderName = hasVisibilityControls ? Boolean(showAppName) : true;
  const renderLogo = hasVisibilityControls ? Boolean(showAppLogo) : true;
  const visibleLogoImageUrl = renderLogo ? (logoImageUrl ?? "/logo/logo.png") : undefined;

  if (!visibleLogoImageUrl && !renderName) return null;

  const className = `${classes.customBrand} ${celebrating ? classes.celebratingWordmark : ""}`;

  return (
    <div
      className={className}
      data-large={large || undefined}
      aria-label={resolvedAppName}
      onMouseEnter={(event) => celebrate(event.currentTarget)}
      onAnimationEnd={() => setCelebrating(false)}
    >
      {visibleLogoImageUrl ? (
        <img className={classes.customBrandImage} src={visibleLogoImageUrl} alt={renderName ? "" : resolvedAppName} />
      ) : null}
      {renderName ? <span>{resolvedAppName}</span> : null}
    </div>
  );
};
