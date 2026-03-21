import { Shell } from "@/components/shell";
import { getAuthenticatedUser } from "@/lib/api-utils";
import { getStats, getWorkouts } from "@/lib/data";
import { DashboardClient } from "./dashboard-client";
import { LandingClient } from "./landing-client";

export default async function HomePage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return (
      <Shell>
        <LandingClient />
      </Shell>
    );
  }

  const [workouts, stats] = await Promise.all([
    getWorkouts(user.id),
    getStats(user.id),
  ]);

  return (
    <Shell>
      <DashboardClient
        userName={user.name?.split(" ")[0] ?? null}
        workouts={workouts}
        stats={stats}
      />
    </Shell>
  );
}
