import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getAuthenticatedUser } from "@/lib/api-utils";
import { getStats } from "@/lib/data";
import { ProgressClient } from "./progress-client";

export default async function ProgressPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/");

  const stats = await getStats(user.id);

  return (
    <Shell>
      <ProgressClient initialStats={stats} />
    </Shell>
  );
}
