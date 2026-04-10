import {
  Avatar,
  Box,
  Card,
  Code,
  Heading,
  HStack,
  Stack,
  Text,
} from "@chakra-ui/react";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getAuthenticatedUser } from "@/lib/api-utils";
import { ConnectedClients } from "./connected-clients";

export default async function SettingsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/");

  const mcpEndpoint = `${process.env.BETTER_AUTH_URL ?? ""}/api/mcp`;

  return (
    <Shell>
      <Stack gap="8">
        <Heading size="xl">Settings</Heading>

        {/* Account Info */}
        <Card.Root>
          <Card.Header>
            <Heading size="md">Account</Heading>
          </Card.Header>
          <Card.Body>
            <HStack gap="4">
              <Avatar.Root size="lg">
                <Avatar.Image src={user.image ?? undefined} />
                <Avatar.Fallback>{user.name?.charAt(0) ?? "U"}</Avatar.Fallback>
              </Avatar.Root>
              <Stack gap="1">
                <Text fontWeight="semibold">{user.name}</Text>
                <Text textStyle="sm" color="fg.muted">
                  {user.email}
                </Text>
                <Text textStyle="xs" color="fg.subtle">
                  Member since{" "}
                  {new Date(user.createdAt).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
              </Stack>
            </HStack>
          </Card.Body>
        </Card.Root>

        {/* MCP Connection */}
        <Card.Root>
          <Card.Header>
            <Heading size="md">MCP Connection</Heading>
            <Text textStyle="sm" color="fg.muted">
              Connect AI clients like Claude or ChatGPT to manage your workouts
              via natural language.
            </Text>
          </Card.Header>
          <Card.Body>
            <Stack gap="4">
              <Box>
                <Text fontWeight="medium" mb="1">
                  Endpoint
                </Text>
                <Code size="sm" p="2" display="block" borderRadius="md">
                  {mcpEndpoint}
                </Code>
              </Box>

              <Text textStyle="sm" color="fg.muted">
                Add this URL as a remote MCP server in your AI client. On first
                connect, a browser window will open for Google login. After
                authenticating, the client can access your workout data.
              </Text>
            </Stack>
          </Card.Body>
        </Card.Root>

        {/* Connected Clients */}
        <ConnectedClients />
      </Stack>
    </Shell>
  );
}
