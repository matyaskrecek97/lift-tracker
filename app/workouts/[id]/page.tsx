import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getAuthenticatedUser } from "@/lib/api-utils";
import { getPlaces, getWorkout } from "@/lib/data";
import { WorkoutEditor } from "./workout-editor";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkoutPage({ params }: PageProps) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/");

  const { id } = await params;
  const [workout, places] = await Promise.all([
    getWorkout(user.id, id),
    getPlaces(user.id),
  ]);

  if (!workout) notFound();

  return (
    <Shell>
      <WorkoutEditor initialWorkout={workout} initialPlaces={places} />
    </Shell>
  );
}
