"use client";

import { Box, Button, Heading, Stack, Text } from "@chakra-ui/react";
import { signIn } from "@/lib/auth-client";

export function LandingClient() {
  return (
    <Stack gap="8">
      <Box>
        <Heading size="2xl" mb="2">
          Welcome to Lift Tracker
        </Heading>
        <Text color="fg.muted">
          Sign in to start tracking your workouts and see your progress
        </Text>
      </Box>
      <Button
        colorPalette="blue"
        size="lg"
        onClick={() => signIn.social({ provider: "google" })}
        alignSelf="flex-start"
      >
        Sign in with Google
      </Button>
    </Stack>
  );
}
