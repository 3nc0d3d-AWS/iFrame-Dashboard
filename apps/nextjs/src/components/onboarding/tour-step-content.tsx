"use client";

import type { ReactNode } from "react";
import { Group, Stack, Text, ThemeIcon } from "@mantine/core";

interface TourStepContentProps {
  description: string;
  icon?: ReactNode;
}

export const TourStepContent = ({ description, icon }: TourStepContentProps) => {
  return (
    <Stack gap="sm">
      <Group gap="sm" wrap="nowrap" align="flex-start">
        {icon && (
          <ThemeIcon variant="light" size="lg" radius="md" mt={2}>
            {icon}
          </ThemeIcon>
        )}
        <Text size="sm" lh={1.7} style={{ flex: 1 }}>
          {description}
        </Text>
      </Group>
    </Stack>
  );
};
