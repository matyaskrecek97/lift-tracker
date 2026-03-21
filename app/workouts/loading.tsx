"use client";

import { Flex, Spinner } from "@chakra-ui/react";
import { Shell } from "@/components/shell";

export default function Loading() {
  return (
    <Shell>
      <Flex justify="center" py="20">
        <Spinner size="xl" />
      </Flex>
    </Shell>
  );
}
