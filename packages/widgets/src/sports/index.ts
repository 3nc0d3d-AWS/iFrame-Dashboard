import { IconBallBasketball, IconServerOff } from "@tabler/icons-react";

import { clientApi } from "@homarr/api/client";

import { useFormContext } from "../_inputs/form";
import { createWidgetDefinition } from "../definition";
import { optionsBuilder } from "../options";

export const { definition, componentLoader } = createWidgetDefinition("sports", {
  icon: IconBallBasketball,
  // Scores can change while a game is live, so refresh a few times per hour.
  refetchInterval: 5 * 60,
  errors: {
    BAD_GATEWAY: {
      icon: IconServerOff,
      message: (t) => t("widget.sports.error.allLeaguesFailed"),
    },
  },
  createOptions() {
    return optionsBuilder.from((factory) => ({
      leagues: factory.dynamicMultiSelect({
        defaultValue: [],
        maxValues: 60,
        withDescription: true,
        useOptions() {
          const form = useFormContext();
          const apiKey = typeof form.getValues().options.apiKey === "string"
            ? (form.getValues().options.apiKey as string)
            : "";
          const { data = [], isPending, isError } = clientApi.widget.sports.getLeagues.useQuery({ apiKey });
          return {
            data: data.map((league) => ({ value: league.id, label: league.label })),
            isPending,
            isError,
          };
        },
      }),
      apiKey: factory.text({
        defaultValue: "",
        withDescription: true,
      }),
      scrollSpeed: factory.select({
        defaultValue: "normal",
        options: [
          { value: "slow", label: (t) => t("widget.sports.option.scrollSpeed.slow") },
          { value: "normal", label: (t) => t("widget.sports.option.scrollSpeed.normal") },
          { value: "fast", label: (t) => t("widget.sports.option.scrollSpeed.fast") },
        ] as const,
      }),
      showScores: factory.switch({ defaultValue: true }),
      showLogos: factory.switch({ defaultValue: true }),
      showVenue: factory.switch({ defaultValue: false }),
    }));
  },
}).withDynamicImport(() => import("./component"));
