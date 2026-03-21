import { PrismaPg } from "@prisma/adapter-pg";
import type { Prisma } from "@/app/generated/prisma/client";
import { PrismaClient } from "@/app/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "",
});

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;

export const workoutFullInclude = {
  place: true,
  exercises: {
    include: {
      exercise: {
        include: {
          primaryBodyPart: true,
          secondaryBodyParts: true,
          equipment: true,
        },
      },
      equipment: true,
      sets: { orderBy: { order: "asc" } },
    },
    orderBy: { order: "asc" },
  },
} satisfies Prisma.WorkoutInclude;
