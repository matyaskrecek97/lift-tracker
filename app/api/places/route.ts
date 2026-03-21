import { type NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAuthenticatedUser,
  parseJsonBody,
  unauthorized,
} from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import { createPlaceSchema } from "@/lib/validations";

// GET /api/places - List user's places
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const includeArchived =
    request.nextUrl.searchParams.get("includeArchived") === "true";

  const places = await prisma.place.findMany({
    where: {
      userId: user.id,
      ...(includeArchived ? {} : { isArchived: false }),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(places);
}

// POST /api/places - Create a new place
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const result = await parseJsonBody(request);
  if ("error" in result) return result.error;
  const body = result.data;
  const parsed = createPlaceSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  const place = await prisma.place.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
    },
  });

  return NextResponse.json(place, { status: 201 });
}
