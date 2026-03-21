import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getAuthenticatedUser } from "@/lib/api-utils";
import { getTemplate } from "@/lib/data";
import { TemplateEditor } from "./template-editor";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TemplatePage({ params }: PageProps) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/");

  const { id } = await params;
  const template = await getTemplate(user.id, id);
  if (!template) notFound();

  return (
    <Shell>
      <TemplateEditor template={template} />
    </Shell>
  );
}
