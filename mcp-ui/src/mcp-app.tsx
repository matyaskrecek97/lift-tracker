import type { App } from "@modelcontextprotocol/ext-apps";
import {
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
} from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Workout } from "./types";
import { WorkoutEditor } from "./workout-editor";
import "./styles.css";

function McpWorkoutApp() {
  const [workout, setWorkout] = useState<Workout | null>(null);

  const onAppCreated = useCallback((app: App) => {
    app.ontoolresult = (result) => {
      const data = result.structuredContent as unknown as Workout | undefined;
      if (data?.id) {
        setWorkout(data);
      }
    };

    app.onhostcontextchanged = (ctx) => {
      if (ctx.theme) applyDocumentTheme(ctx.theme);
      if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
      if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
    };
  }, []);

  const { app, isConnected } = useApp({
    appInfo: { name: "lift-tracker-workout-editor", version: "1.0.0" },
    capabilities: {},
    onAppCreated,
  });

  if (!isConnected || !app) {
    return <div className="loading">Connecting to host...</div>;
  }

  if (!workout) {
    return <div className="loading">Waiting for workout data...</div>;
  }

  return (
    <WorkoutEditor app={app} workout={workout} onWorkoutChange={setWorkout} />
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<McpWorkoutApp />);
