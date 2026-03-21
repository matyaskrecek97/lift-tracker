import { type NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  badRequest,
  getAuthenticatedUser,
  parseJsonBody,
  unauthorized,
} from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import { createExerciseSchema } from "@/lib/validations";

// GET /api/exercises - List/search exercise catalog (public + user's private)
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q") || undefined;
  const includePrivate = searchParams.get("includePrivate") === "true";
  const bodyPartSlug = searchParams.get("bodyPartSlug") || undefined;
  const bodyPartSlugs = searchParams.get("bodyPartSlugs") || undefined;
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit")) || 50, 1),
    100,
  );

  const whereClause: Prisma.ExerciseWhereInput = {};

  // Include public exercises and optionally user's private exercises
  if (includePrivate) {
    whereClause.OR = [{ isPublic: true }, { createdById: user.id }];
  } else {
    whereClause.isPublic = true;
  }

  // Search by name or czech name
  if (q) {
    whereClause.AND = [
      whereClause.OR ? { OR: whereClause.OR } : { isPublic: true },
      {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { czechName: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
    delete whereClause.OR;
  }

  if (bodyPartSlugs) {
    const slugs = bodyPartSlugs.split(",").filter(Boolean);
    if (slugs.length > 0) {
      whereClause.primaryBodyPart = { slug: { in: slugs } };
    }
  } else if (bodyPartSlug) {
    whereClause.primaryBodyPart = { slug: bodyPartSlug };
  }

  const exercises = await prisma.exercise.findMany({
    where: whereClause,
    include: {
      primaryBodyPart: true,
      secondaryBodyParts: true,
      equipment: true,
    },
    orderBy: [
      { isPublic: "desc" }, // Public first
      { name: "asc" },
    ],
    take: limit,
  });

  return NextResponse.json(exercises);
}

function generateSlug(name: string, userId: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return `${base}_${userId.slice(0, 8)}`;
}

// POST /api/exercises - Create a new exercise
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const result = await parseJsonBody(request);
  if ("error" in result) return result.error;
  const body = result.data;
  const parsed = createExerciseSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  const {
    name,
    slug: providedSlug,
    czechName,
    primaryBodyPartSlug,
    secondaryBodyPartSlugs,
    equipmentSlug,
    isPublic,
  } = parsed.data;

  // Public exercises must provide a slug (from LLM). Private ones auto-generate.
  const slug = providedSlug ?? generateSlug(name, user.id);

  // Resolve body part and equipment IDs
  const primaryBodyPart = primaryBodyPartSlug
    ? await prisma.bodyPart.findUnique({ where: { slug: primaryBodyPartSlug } })
    : null;

  const secondaryBodyParts = secondaryBodyPartSlugs
    ? await prisma.bodyPart.findMany({
        where: { slug: { in: secondaryBodyPartSlugs } },
      })
    : [];

  const equipment = equipmentSlug
    ? await prisma.equipment.findUnique({ where: { slug: equipmentSlug } })
    : null;

  // Create exercise
  const exercise = await prisma.exercise.create({
    data: {
      name,
      slug,
      czechName,
      isPublic,
      createdById: user.id,
      primaryBodyPartId: primaryBodyPart?.id,
      equipmentId: equipment?.id,
      secondaryBodyParts: {
        connect: secondaryBodyParts.map((bp) => ({ id: bp.id })),
      },
    },
    include: {
      primaryBodyPart: true,
      secondaryBodyParts: true,
      equipment: true,
    },
  });

  return NextResponse.json(exercise, { status: 201 });
}
