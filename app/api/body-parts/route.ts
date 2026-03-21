import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, unauthorized } from "@/lib/api-utils";
import prisma from "@/lib/prisma";

// GET /api/body-parts - List all body parts (read-only, from seed)
export async function GET(_request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const bodyParts = await prisma.bodyPart.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(bodyParts);
}
