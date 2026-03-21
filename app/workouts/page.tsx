import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getAuthenticatedUser } from "@/lib/api-utils";
import { getPlaces, getWorkouts } from "@/lib/data";
import { WorkoutsList } from "./workouts-list";

export default async function WorkoutsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/");

  const [workouts, places] = await Promise.all([
    getWorkouts(user.id, 200),
    getPlaces(user.id),
  ]);

  return (
    <Shell>
      <WorkoutsList workouts={workouts} places={places} />
    </Shell>
  );
}
