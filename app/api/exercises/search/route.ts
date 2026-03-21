import { type NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  getAuthenticatedUser,
  parseJsonBody,
  serverError,
  unauthorized,
} from "@/lib/api-utils";
import { searchExerciseWithAI } from "@/lib/exercise-agent";
import prisma from "@/lib/prisma";
import { exerciseAISearchSchema } from "@/lib/validations";

// POST /api/exercises/search - Search exercises with optional LLM enhancement
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const result = await parseJsonBody(request);
  if ("error" in result) return result.error;
  const body = result.data;
  const parsed = exerciseAISearchSchema.safeParse(body);

  if (!parsed.success) {
    return badRequest(parsed.error.message);
  }

  const { query, useLLM } = parsed.data;

  if (!useLLM) {
    // Tier 1: Simple DB search
    const exercises = await prisma.exercise.findMany({
      where: {
        AND: [
          {
            OR: [{ isPublic: true }, { createdById: user.id }],
          },
          {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { czechName: { contains: query, mode: "insensitive" } },
            ],
          },
        ],
      },
      include: {
        primaryBodyPart: true,
        secondaryBodyParts: true,
        equipment: true,
      },
      orderBy: [
        { isPublic: "desc" }, // Public first
        { name: "asc" },
      ],
      take: 20,
    });

    return NextResponse.json({ exercises, suggestion: null });
  }

  // Tier 2: LLM-powered search and suggestion
  try {
    const suggestion = await searchExerciseWithAI(query, user.id);

    // Also return any direct DB matches for context
    const exercises = await prisma.exercise.findMany({
      where: {
        AND: [
          {
            OR: [{ isPublic: true }, { createdById: user.id }],
          },
          {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { czechName: { contains: query, mode: "insensitive" } },
            ],
          },
        ],
      },
      include: {
        primaryBodyPart: true,
        secondaryBodyParts: true,
        equipment: true,
      },
      take: 5,
    });

    return NextResponse.json({ exercises, suggestion });
  } catch (error) {
    console.error("LLM search error:", error);
    return serverError("Failed to process search with AI");
  }
}
