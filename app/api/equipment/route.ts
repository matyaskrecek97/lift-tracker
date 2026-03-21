import { type NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAuthenticatedUser,
  parseJsonBody,
  unauthorized,
} from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import { createEquipmentSchema } from "@/lib/validations";

// GET /api/equipment - List all public equipment + user's private equipment
export async function GET(_request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const equipment = await prisma.equipment.findMany({
    where: {
      OR: [{ isPublic: true }, { createdById: user.id }],
    },
    orderBy: [
      { isPublic: "desc" }, // Public first
      { sortOrder: "asc" },
      { name: "asc" },
    ],
  });

  return NextResponse.json(equipment);
}

// POST /api/equipment - Create private equipment
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const result = await parseJsonBody(request);
  if ("error" in result) return result.error;
  const body = result.data;
  const parsed = createEquipmentSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  const { name, czechName } = parsed.data;

  // Generate slug
  const slug = name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");

  // Check for duplicate
  const existing = await prisma.equipment.findFirst({
    where: {
      name,
      createdById: user.id,
    },
  });

  if (existing) {
    return NextResponse.json(existing, { status: 200 });
  }

  const equipment = await prisma.equipment.create({
    data: {
      name,
      czechName,
      slug: `${slug}-${user.id.slice(0, 8)}`, // Add user ID to avoid slug conflicts
      isPublic: false,
      createdById: user.id,
    },
  });

  return NextResponse.json(equipment, { status: 201 });
}
