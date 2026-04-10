import { NextResponse } from "next/server";
import {
  badRequest,
  getAuthenticatedUser,
  parseJsonBody,
  unauthorized,
} from "@/lib/api-utils";
import prisma from "@/lib/prisma";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const tokens = await prisma.oauthAccessToken.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    distinct: ["clientId"],
    select: {
      clientId: true,
      createdAt: true,
    },
  });

  const clientIds = tokens.map((t) => t.clientId);
  const apps = await prisma.oauthApplication.findMany({
    where: { clientId: { in: clientIds } },
    select: { clientId: true, name: true },
  });

  const appMap = new Map(apps.map((a) => [a.clientId, a.name]));

  const clients = tokens.map((t) => ({
    clientId: t.clientId,
    name: appMap.get(t.clientId) ?? t.clientId,
    connectedAt: t.createdAt.toISOString(),
  }));

  return NextResponse.json({ clients });
}

export async function DELETE(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const result = await parseJsonBody<{ clientId?: string }>(request);
  if ("error" in result) return result.error;

  const { clientId } = result.data;
  if (!clientId) return badRequest("clientId is required");

  await prisma.$transaction([
    prisma.oauthAccessToken.deleteMany({
      where: { userId: user.id, clientId },
    }),
    prisma.oauthConsent.deleteMany({
      where: { userId: user.id, clientId },
    }),
  ]);

  return NextResponse.json({ success: true });
}
