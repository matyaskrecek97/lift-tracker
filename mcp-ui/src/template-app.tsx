import type { App } from "@modelcontextprotocol/ext-apps";
import {
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
} from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { TemplateEditor } from "./template-editor";
import type { WorkoutTemplate } from "./types";
import "./styles.css";

function McpTemplateApp() {
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);

  const onAppCreated = useCallback((app: App) => {
    app.ontoolresult = (result) => {
      const data = result.structuredContent as unknown as
        | WorkoutTemplate
        | undefined;
      if (data?.id) {
        setTemplate(data);
      }
    };

    app.onhostcontextchanged = (ctx) => {
      if (ctx.theme) applyDocumentTheme(ctx.theme);
      if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
      if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
    };
  }, []);

  const { app, isConnected } = useApp({
    appInfo: { name: "lift-tracker-template-editor", version: "1.0.0" },
    capabilities: {},
    onAppCreated,
  });

  if (!isConnected || !app) {
    return <div className="loading">Connecting to host...</div>;
  }

  if (!template) {
    return <div className="loading">Waiting for template data...</div>;
  }

  return (
    <TemplateEditor
      app={app}
      template={template}
      onTemplateChange={setTemplate}
    />
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<McpTemplateApp />);
