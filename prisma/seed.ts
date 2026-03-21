import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "",
});

const prisma = new PrismaClient({ adapter });

const bodyParts = [
  { name: "Chest", czechName: "Prsa", slug: "chest", sortOrder: 1 },
  { name: "Back", czechName: "Záda", slug: "back", sortOrder: 2 },
  { name: "Lats", czechName: "Latissimus", slug: "lats", sortOrder: 3 },
  { name: "Traps", czechName: "Trapézy", slug: "traps", sortOrder: 4 },
  {
    name: "Shoulders (Front)",
    czechName: "Ramena (přední)",
    slug: "shoulders-front",
    sortOrder: 5,
  },
  {
    name: "Shoulders (Side)",
    czechName: "Ramena (boční)",
    slug: "shoulders-side",
    sortOrder: 6,
  },
  {
    name: "Shoulders (Rear)",
    czechName: "Ramena (zadní)",
    slug: "shoulders-rear",
    sortOrder: 7,
  },
  { name: "Biceps", czechName: "Bicepsy", slug: "biceps", sortOrder: 8 },
  { name: "Triceps", czechName: "Tricepsy", slug: "triceps", sortOrder: 9 },
  { name: "Forearms", czechName: "Předloktí", slug: "forearms", sortOrder: 10 },
  { name: "Abs", czechName: "Břicho", slug: "abs", sortOrder: 11 },
  {
    name: "Obliques",
    czechName: "Šikmé břišní",
    slug: "obliques",
    sortOrder: 12,
  },
  {
    name: "Lower Back",
    czechName: "Bederní svaly",
    slug: "lower-back",
    sortOrder: 13,
  },
  { name: "Glutes", czechName: "Hýždě", slug: "glutes", sortOrder: 14 },
  {
    name: "Quads",
    czechName: "Čtyřhlavý sval",
    slug: "quads",
    sortOrder: 15,
  },
  {
    name: "Hamstrings",
    czechName: "Zadní strana stehen",
    slug: "hamstrings",
    sortOrder: 16,
  },
  { name: "Calves", czechName: "Lýtka", slug: "calves", sortOrder: 17 },
  {
    name: "Adductors",
    czechName: "Adduktory",
    slug: "adductors",
    sortOrder: 18,
  },
];

const equipment = [
  {
    name: "Barbell",
    czechName: "Olympijská osa",
    slug: "barbell",
    sortOrder: 1,
  },
  { name: "Dumbbell", czechName: "Jednoručky", slug: "dumbbell", sortOrder: 2 },
  { name: "Cable", czechName: "Kladka", slug: "cable", sortOrder: 3 },
  { name: "Machine", czechName: "Stroj", slug: "machine", sortOrder: 4 },
  {
    name: "Smith Machine",
    czechName: "Smithův stroj",
    slug: "smith-machine",
    sortOrder: 5,
  },
  {
    name: "Bodyweight",
    czechName: "Vlastní váha",
    slug: "bodyweight",
    sortOrder: 6,
  },
  {
    name: "Weighted Bodyweight",
    czechName: "Vlastní váha s přídavkem",
    slug: "weighted-bodyweight",
    sortOrder: 7,
  },
  { name: "Band", czechName: "Guma", slug: "band", sortOrder: 8 },
  {
    name: "Kettlebell",
    czechName: "Kettlebell",
    slug: "kettlebell",
    sortOrder: 9,
  },
  { name: "EZ Bar", czechName: "EZ osa", slug: "ez-bar", sortOrder: 10 },
  { name: "Plate", czechName: "Kotouč", slug: "plate", sortOrder: 11 },
  { name: "Trap Bar", czechName: "Trap bar", slug: "trap-bar", sortOrder: 12 },
  { name: "Landmine", czechName: "Landmine", slug: "landmine", sortOrder: 13 },
  { name: "Suspension", czechName: "TRX", slug: "suspension", sortOrder: 14 },
  { name: "Other", czechName: "Ostatní", slug: "other", sortOrder: 15 },
];

type ExerciseData = {
  name: string; // Readable display name
  slug: string; // OPE standardized identifier
  czechName: string;
  primaryBodyPart: string; // slug
  secondaryBodyParts?: string[]; // slugs
  equipment: string; // slug
};

const exercises: ExerciseData[] = [
  // CHEST
  {
    name: "Bench Press",
    slug: "bench_press",
    czechName: "Bench press",
    primaryBodyPart: "chest",
    secondaryBodyParts: ["shoulders-front", "triceps"],
    equipment: "barbell",
  },
  {
    name: "Cable Crossover",
    slug: "cable_crossover",
    czechName: "Crossover na kladce",
    primaryBodyPart: "chest",
    equipment: "cable",
  },
  {
    name: "Chest Fly",
    slug: "chest_fly",
    czechName: "Rozpažování s jednoručkami",
    primaryBodyPart: "chest",
    equipment: "dumbbell",
  },
  {
    name: "Chest Press",
    slug: "chest_press",
    czechName: "Tlak na prsa",
    primaryBodyPart: "chest",
    secondaryBodyParts: ["shoulders-front", "triceps"],
    equipment: "machine",
  },
  {
    name: "Decline Bench Press",
    slug: "decline_bench_press",
    czechName: "Tlak na sestupné lavici",
    primaryBodyPart: "chest",
    secondaryBodyParts: ["triceps"],
    equipment: "barbell",
  },
  {
    name: "Incline Bench Press",
    slug: "incline_bench_press",
    czechName: "Tlak na šikmé lavici",
    primaryBodyPart: "chest",
    secondaryBodyParts: ["shoulders-front", "triceps"],
    equipment: "barbell",
  },
  {
    name: "Pec Deck Fly",
    slug: "pec_deck_fly",
    czechName: "Rozpažky na stroji (motýlek)",
    primaryBodyPart: "chest",
    equipment: "machine",
  },
  {
    name: "Pullover",
    slug: "pullover",
    czechName: "Pullover s jednoručkou",
    primaryBodyPart: "chest",
    secondaryBodyParts: ["lats", "triceps"],
    equipment: "dumbbell",
  },
  {
    name: "Push Up",
    slug: "push_up",
    czechName: "Klik",
    primaryBodyPart: "chest",
    secondaryBodyParts: ["shoulders-front", "triceps"],
    equipment: "bodyweight",
  },

  // BACK
  {
    name: "Bent Over Row",
    slug: "bent_over_row",
    czechName: "Předklon s osou",
    primaryBodyPart: "back",
    secondaryBodyParts: ["biceps"],
    equipment: "barbell",
  },
  {
    name: "Deadlift",
    slug: "deadlift",
    czechName: "Mrtvý tah",
    primaryBodyPart: "back",
    secondaryBodyParts: ["glutes", "hamstrings", "lower-back", "traps"],
    equipment: "barbell",
  },
  {
    name: "Dumbbell Row",
    slug: "dumbbell_row",
    czechName: "Veslo s jednoručkou",
    primaryBodyPart: "back",
    secondaryBodyParts: ["biceps"],
    equipment: "dumbbell",
  },
  {
    name: "Long Pull",
    slug: "long_pull",
    czechName: "Dlouhý tah",
    primaryBodyPart: "back",
    secondaryBodyParts: ["biceps", "forearms", "traps"],
    equipment: "cable",
  },
  {
    name: "Machine Row",
    slug: "machine_row",
    czechName: "Veslo na stroji",
    primaryBodyPart: "back",
    secondaryBodyParts: ["biceps", "lats"],
    equipment: "machine",
  },
  {
    name: "Seated Row",
    slug: "seated_row",
    czechName: "Veslo vsedě na kladce",
    primaryBodyPart: "back",
    secondaryBodyParts: ["biceps"],
    equipment: "cable",
  },
  {
    name: "T-Bar Row",
    slug: "t_bar_row",
    czechName: "T-bar",
    primaryBodyPart: "back",
    secondaryBodyParts: ["biceps"],
    equipment: "barbell",
  },

  // LATS
  {
    name: "Chin Up",
    slug: "chin_up",
    czechName: "Shyb podchvatem",
    primaryBodyPart: "lats",
    secondaryBodyParts: ["biceps"],
    equipment: "bodyweight",
  },
  {
    name: "Lat Pulldown",
    slug: "lat_pulldown",
    czechName: "Stahování kladky za hlavu",
    primaryBodyPart: "lats",
    secondaryBodyParts: ["biceps"],
    equipment: "cable",
  },
  {
    name: "Pull Up",
    slug: "pull_up",
    czechName: "Shyb",
    primaryBodyPart: "lats",
    secondaryBodyParts: ["back", "biceps"],
    equipment: "bodyweight",
  },

  // TRAPS
  {
    name: "Shrug",
    slug: "shrug",
    czechName: "Vzpínání ramen",
    primaryBodyPart: "traps",
    equipment: "barbell",
  },

  // SHOULDERS
  {
    name: "Front Raise",
    slug: "front_raise",
    czechName: "Předpažování",
    primaryBodyPart: "shoulders-front",
    equipment: "dumbbell",
  },
  {
    name: "Overhead Press",
    slug: "overhead_press",
    czechName: "Tlak nad hlavu",
    primaryBodyPart: "shoulders-front",
    secondaryBodyParts: ["triceps"],
    equipment: "barbell",
  },
  {
    name: "Shoulder Press",
    slug: "shoulder_press",
    czechName: "Tlak s jednoručkami nad hlavu",
    primaryBodyPart: "shoulders-front",
    secondaryBodyParts: ["triceps"],
    equipment: "dumbbell",
  },
  {
    name: "Lateral Raise",
    slug: "lateral_raise",
    czechName: "Laterální vzpažování",
    primaryBodyPart: "shoulders-side",
    equipment: "dumbbell",
  },
  {
    name: "Face Pull",
    slug: "face_pull",
    czechName: "Face pull",
    primaryBodyPart: "shoulders-rear",
    secondaryBodyParts: ["traps"],
    equipment: "cable",
  },
  {
    name: "Rear Delt Fly",
    slug: "rear_delt_fly",
    czechName: "Reverse fly",
    primaryBodyPart: "shoulders-rear",
    equipment: "dumbbell",
  },

  // BICEPS
  {
    name: "Bicep Curl",
    slug: "bicep_curl",
    czechName: "Bicepsový zdvih s osou",
    primaryBodyPart: "biceps",
    equipment: "dumbbell",
  },
  {
    name: "Hammer Curl",
    slug: "hammer_curl",
    czechName: "Kladivový zdvih",
    primaryBodyPart: "biceps",
    secondaryBodyParts: ["forearms"],
    equipment: "dumbbell",
  },
  {
    name: "Incline Biceps Curl",
    slug: "incline_biceps_curl",
    czechName: "Bicepsový zdvih na šikmé lavici",
    primaryBodyPart: "biceps",
    secondaryBodyParts: ["forearms"],
    equipment: "dumbbell",
  },
  {
    name: "Incline Curl",
    slug: "incline_curl",
    czechName: "Bicepsový zdvih na šikmé lavici",
    primaryBodyPart: "biceps",
    equipment: "dumbbell",
  },
  {
    name: "Preacher Curl",
    slug: "preacher_curl",
    czechName: "Scott curl",
    primaryBodyPart: "biceps",
    equipment: "ez-bar",
  },

  // TRICEPS
  {
    name: "Close Grip Bench Press",
    slug: "close_grip_bench_press",
    czechName: "Bench press úzkým úchopem",
    primaryBodyPart: "triceps",
    secondaryBodyParts: ["chest"],
    equipment: "barbell",
  },
  {
    name: "Overhead Triceps Extension",
    slug: "overhead_triceps_extension",
    czechName: "Propínání paží nad hlavou",
    primaryBodyPart: "triceps",
    equipment: "dumbbell",
  },
  {
    name: "Skull Crusher",
    slug: "skull_crusher",
    czechName: "Francouzský tlak",
    primaryBodyPart: "triceps",
    equipment: "ez-bar",
  },
  {
    name: "Triceps Dip",
    slug: "triceps_dip",
    czechName: "Kliky na bradlech",
    primaryBodyPart: "triceps",
    secondaryBodyParts: ["chest"],
    equipment: "bodyweight",
  },
  {
    name: "Triceps Pushdown",
    slug: "triceps_pushdown",
    czechName: "Tlak na kladce",
    primaryBodyPart: "triceps",
    equipment: "cable",
  },

  // ABS
  {
    name: "Cable Crunch",
    slug: "cable_crunch",
    czechName: "Crunch na kladce",
    primaryBodyPart: "abs",
    equipment: "cable",
  },
  {
    name: "Crunch",
    slug: "crunch",
    czechName: "Sed lehy",
    primaryBodyPart: "abs",
    equipment: "bodyweight",
  },
  {
    name: "Kettlebell Russian Twist",
    slug: "kettlebell_russian_twist",
    czechName: "Ruský twist s kettlebellem",
    primaryBodyPart: "abs",
    secondaryBodyParts: ["obliques"],
    equipment: "kettlebell",
  },
  {
    name: "Leg Raise",
    slug: "leg_raise",
    czechName: "Zdvih nohou",
    primaryBodyPart: "abs",
    equipment: "bodyweight",
  },
  {
    name: "Plank",
    slug: "plank",
    czechName: "Prkno",
    primaryBodyPart: "abs",
    equipment: "bodyweight",
  },
  {
    name: "Reverse Crunch",
    slug: "reverse_crunch",
    czechName: "Obrácený sed leh",
    primaryBodyPart: "abs",
    equipment: "bodyweight",
  },

  // LOWER BACK
  {
    name: "Back Extension",
    slug: "back_extension",
    czechName: "Vzpřimování trupu",
    primaryBodyPart: "lower-back",
    secondaryBodyParts: ["glutes", "hamstrings"],
    equipment: "machine",
  },

  // GLUTES
  {
    name: "Hip Abduction",
    slug: "hip_abduction",
    czechName: "Odtažení kyčle",
    primaryBodyPart: "glutes",
    secondaryBodyParts: ["adductors"],
    equipment: "machine",
  },
  {
    name: "Hip Thrust",
    slug: "hip_thrust",
    czechName: "Hip thrust",
    primaryBodyPart: "glutes",
    equipment: "barbell",
  },

  // QUADS
  {
    name: "Bulgarian Split Squat",
    slug: "bulgarian_split_squat",
    czechName: "Bulharský dřep",
    primaryBodyPart: "quads",
    secondaryBodyParts: ["glutes"],
    equipment: "dumbbell",
  },
  {
    name: "Front Squat",
    slug: "front_squat",
    czechName: "Dřep s osou na prsou",
    primaryBodyPart: "quads",
    secondaryBodyParts: ["glutes"],
    equipment: "barbell",
  },
  {
    name: "Leg Extension",
    slug: "leg_extension",
    czechName: "Leg extension",
    primaryBodyPart: "quads",
    equipment: "machine",
  },
  {
    name: "Leg Press",
    slug: "leg_press",
    czechName: "Leg press",
    primaryBodyPart: "quads",
    secondaryBodyParts: ["glutes", "hamstrings"],
    equipment: "machine",
  },
  {
    name: "Lunge",
    slug: "lunge",
    czechName: "Výpad",
    primaryBodyPart: "quads",
    secondaryBodyParts: ["glutes"],
    equipment: "dumbbell",
  },
  {
    name: "Squat",
    slug: "squat",
    czechName: "Dřep",
    primaryBodyPart: "quads",
    secondaryBodyParts: ["glutes", "hamstrings"],
    equipment: "barbell",
  },

  // HAMSTRINGS
  {
    name: "Leg Curl",
    slug: "leg_curl",
    czechName: "Leg curl",
    primaryBodyPart: "hamstrings",
    equipment: "machine",
  },
  {
    name: "Romanian Deadlift",
    slug: "romanian_deadlift",
    czechName: "Rumunský mrtvý tah",
    primaryBodyPart: "hamstrings",
    secondaryBodyParts: ["glutes", "lower-back"],
    equipment: "barbell",
  },

  // CALVES
  {
    name: "Calf Raise",
    slug: "calf_raise",
    czechName: "Výpony",
    primaryBodyPart: "calves",
    equipment: "bodyweight",
  },
  {
    name: "Seated Calf Raise",
    slug: "seated_calf_raise",
    czechName: "Výpony v sedě",
    primaryBodyPart: "calves",
    equipment: "machine",
  },
];

async function main() {
  console.log("🌱 Starting seed...");

  // Seed BodyParts
  console.log("📍 Seeding body parts...");
  for (const bp of bodyParts) {
    await prisma.bodyPart.upsert({
      where: { slug: bp.slug },
      update: bp,
      create: bp,
    });
  }
  console.log(`✅ Seeded ${bodyParts.length} body parts`);

  // Seed Equipment
  console.log("🔧 Seeding equipment...");
  for (const eq of equipment) {
    await prisma.equipment.upsert({
      where: { slug: eq.slug },
      update: { ...eq, isPublic: true, createdById: null },
      create: { ...eq, isPublic: true, createdById: null },
    });
  }
  console.log(`✅ Seeded ${equipment.length} equipment items`);

  // Seed Exercises
  console.log("💪 Seeding exercises...");
  for (const ex of exercises) {
    const primaryBodyPart = await prisma.bodyPart.findUnique({
      where: { slug: ex.primaryBodyPart },
    });
    const equipmentRecord = await prisma.equipment.findUnique({
      where: { slug: ex.equipment },
    });

    if (!primaryBodyPart || !equipmentRecord) {
      console.warn(`⚠️  Skipping ${ex.name}: missing body part or equipment`);
      continue;
    }

    // Find secondary body parts
    const secondaryBodyParts = ex.secondaryBodyParts
      ? await prisma.bodyPart.findMany({
          where: { slug: { in: ex.secondaryBodyParts } },
        })
      : [];

    await prisma.exercise.upsert({
      where: { slug: ex.slug },
      update: {
        name: ex.name,
        czechName: ex.czechName,
        primaryBodyPartId: primaryBodyPart.id,
        equipmentId: equipmentRecord.id,
        secondaryBodyParts: {
          set: secondaryBodyParts.map((bp) => ({ id: bp.id })),
        },
      },
      create: {
        name: ex.name,
        slug: ex.slug,
        czechName: ex.czechName,
        isPublic: true,
        createdById: null,
        primaryBodyPartId: primaryBodyPart.id,
        equipmentId: equipmentRecord.id,
        secondaryBodyParts: {
          connect: secondaryBodyParts.map((bp) => ({ id: bp.id })),
        },
      },
    });
  }
  console.log(`✅ Seeded ${exercises.length} exercises`);

  console.log("✨ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
