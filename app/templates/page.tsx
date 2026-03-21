import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getAuthenticatedUser } from "@/lib/api-utils";
import { getTemplates } from "@/lib/data";
import { TemplatesClient } from "./templates-client";

export default async function TemplatesPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/");

  const templates = await getTemplates(user.id);

  return (
    <Shell>
      <TemplatesClient templates={templates} />
    </Shell>
  );
}
