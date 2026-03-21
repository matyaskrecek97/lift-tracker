import { NextResponse } from "next/server";
import { getAuthenticatedUser, unauthorized } from "@/lib/api-utils";
import prisma from "@/lib/prisma";

const templateDefinitions = [
  {
    name: "Legs",
    items: [
      { exerciseSlug: "squat", order: 1 },
      { exerciseSlug: "romanian_deadlift", order: 2 },
      { exerciseSlug: "calf_raise", order: 3 },
      { exerciseSlug: "hip_abductor", order: 4 },
    ],
  },
  {
    name: "Push",
    items: [
      { exerciseSlug: "bench_press", order: 1 },
      {
        exerciseSlug: "tricep_dip",
        equipmentSlug: "weighted-bodyweight",
        order: 2,
      },
      { exerciseSlug: "overhead_press", order: 3 },
      { exerciseSlug: "lateral_raise", order: 4 },
    ],
  },
  {
    name: "Pull",
    items: [
      { exerciseSlug: "chin_up", order: 1 },
      { exerciseSlug: "seated_cable_row", order: 2 },
      { exerciseSlug: "face_pull", order: 3 },
      { exerciseSlug: "preacher_curl", order: 4 },
    ],
  },
];

// POST /api/templates/seed-examples - Create example templates for user
export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  // Skip if user already has templates
  const existingCount = await prisma.workoutTemplate.count({
    where: { userId: user.id },
  });
  if (existingCount > 0) {
    return NextResponse.json(
      { error: "You already have templates" },
      { status: 409 },
    );
  }

  // Look up exercises and equipment by slug
  const allExercises = await prisma.exercise.findMany({
    where: {
      slug: {
        in: templateDefinitions.flatMap((t) =>
          t.items.map((i) => i.exerciseSlug),
        ),
      },
    },
  });
  const allEquipment = await prisma.equipment.findMany();

  const exerciseBySlug = new Map(allExercises.map((e) => [e.slug, e]));
  const equipmentBySlug = new Map(allEquipment.map((e) => [e.slug, e]));

  const created = [];

  for (const tmpl of templateDefinitions) {
    const items = tmpl.items
      .map((item) => {
        const exercise = exerciseBySlug.get(item.exerciseSlug);
        if (!exercise) return null;
        const equipmentId =
          "equipmentSlug" in item && item.equipmentSlug
            ? (equipmentBySlug.get(item.equipmentSlug)?.id ?? null)
            : null;
        return {
          order: item.order,
          exerciseId: exercise.id,
          ...(equipmentId ? { equipmentId } : {}),
        };
      })
      .filter(Boolean) as {
      order: number;
      exerciseId: string;
      equipmentId?: string;
    }[];

    const template = await prisma.workoutTemplate.create({
      data: {
        name: tmpl.name,
        userId: user.id,
        items: { create: items },
      },
      include: {
        items: {
          include: {
            exercise: {
              include: {
                primaryBodyPart: true,
                secondaryBodyParts: true,
                equipment: true,
              },
            },
            equipment: true,
          },
          orderBy: { order: "asc" },
        },
      },
    });
    created.push(template);
  }

  return NextResponse.json(created, { status: 201 });
}
