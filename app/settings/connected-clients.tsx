"use client";

import {
  Box,
  Button,
  Card,
  Heading,
  HStack,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import useSWR from "swr";

interface McpClient {
  clientId: string;
  name: string;
  connectedAt: string;
}

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json();
  });

export function ConnectedClients() {
  const { data, error, isLoading, mutate } = useSWR<{ clients: McpClient[] }>(
    "/api/mcp-clients",
    fetcher,
  );

  async function revokeClient(clientId: string) {
    try {
      const res = await fetch("/api/mcp-clients", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      mutate();
    } catch {
      mutate();
    }
  }

  return (
    <Card.Root>
      <Card.Header>
        <Heading size="md">Connected Clients</Heading>
        <Text textStyle="sm" color="fg.muted">
          AI clients that have access to your workout data via MCP.
        </Text>
      </Card.Header>
      <Card.Body>
        {isLoading && (
          <HStack justify="center" py="4">
            <Spinner size="sm" />
            <Text textStyle="sm" color="fg.muted">
              Loading clients...
            </Text>
          </HStack>
        )}

        {error && (
          <Text textStyle="sm" color="fg.error">
            Failed to load connected clients.
          </Text>
        )}

        {data && data.clients.length === 0 && (
          <Text textStyle="sm" color="fg.muted">
            No clients connected yet. Follow the instructions above to connect
            an AI client.
          </Text>
        )}

        {data && data.clients.length > 0 && (
          <Stack gap="3">
            {data.clients.map((client) => (
              <Box
                key={client.clientId}
                p="3"
                borderWidth="1px"
                borderRadius="md"
                borderColor="border.muted"
              >
                <HStack justify="space-between" align="center">
                  <Stack gap="0.5">
                    <Text fontWeight="medium">
                      {client.name || client.clientId}
                    </Text>
                    <Text textStyle="xs" color="fg.subtle">
                      Connected{" "}
                      {new Date(client.connectedAt).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        },
                      )}
                    </Text>
                  </Stack>
                  <Button
                    size="xs"
                    variant="outline"
                    colorPalette="red"
                    onClick={() => revokeClient(client.clientId)}
                  >
                    Revoke
                  </Button>
                </HStack>
              </Box>
            ))}
          </Stack>
        )}
      </Card.Body>
    </Card.Root>
  );
}
