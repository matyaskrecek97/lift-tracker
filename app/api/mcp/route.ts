import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { auth } from "@/lib/auth";
import { registerTools } from "@/lib/mcp-tools";

const mcpHandler = createMcpHandler(
  (server) => {
    registerTools(server);
  },
  {
    capabilities: {},
  },
  {
    streamableHttpEndpoint: "/api/mcp",
    disableSse: true,
    verboseLogs: true,
  },
);

const handler = withMcpAuth(
  mcpHandler,
  async (req, bearerToken) => {
    const session = await auth.api.getMcpSession({
      headers: req.headers,
    });
    if (!session) return undefined;
    return {
      token: bearerToken ?? "",
      clientId: session.clientId ?? "",
      scopes: session.scopes?.split(",") ?? [],
      extra: { userId: session.userId },
    };
  },
  { required: true },
);

export { handler as GET, handler as POST, handler as DELETE };
