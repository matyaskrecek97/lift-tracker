import type { App } from "@modelcontextprotocol/ext-apps";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExerciseSearch } from "./exercise-search";
import type { WorkoutTemplate, WorkoutTemplateItem } from "./types";

interface Props {
  app: App;
  template: WorkoutTemplate;
  onTemplateChange: (t: WorkoutTemplate) => void;
}

export function TemplateEditor({ app, template, onTemplateChange }: Props) {
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [editingName, setEditingName] = useState(template.name);
  const nameTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    setEditingName(template.name);
  }, [template.name]);

  const refreshTemplate = useCallback(async () => {
    try {
      const result = await app.callServerTool({
        name: "get_workout_template",
        arguments: { templateId: template.id },
      });
      const data = result.structuredContent as unknown as
        | WorkoutTemplate
        | undefined;
      if (data?.id) onTemplateChange(data);
    } catch (e) {
      console.error("Failed to refresh template:", e);
    }
  }, [app, template.id, onTemplateChange]);

  const itemsPayload = useCallback(
    (items: WorkoutTemplateItem[]) =>
      items.map((item, index) => ({
        exerciseId: item.exercise.id,
        equipmentId: item.equipment?.id ?? null,
        order: index,
      })),
    [],
  );

  const handleNameChange = (value: string) => {
    setEditingName(value);
    clearTimeout(nameTimerRef.current);
    nameTimerRef.current = setTimeout(async () => {
      const trimmed = value.trim();
      if (!trimmed || trimmed === template.name) return;
      try {
        await app.callServerTool({
          name: "update_workout_template",
          arguments: { templateId: template.id, name: trimmed },
        });
        await refreshTemplate();
      } catch (e) {
        console.error("Failed to update template name:", e);
      }
    }, 600);
  };

  const handleAddExercise = useCallback(
    async (exerciseId: string) => {
      const newItems = [
        ...itemsPayload(template.items),
        {
          exerciseId,
          equipmentId: null,
          order: template.items.length,
        },
      ];
      await app.callServerTool({
        name: "update_workout_template",
        arguments: { templateId: template.id, items: newItems },
      });
      setIsAddingExercise(false);
      await refreshTemplate();
    },
    [app, template.id, template.items, itemsPayload, refreshTemplate],
  );

  const handleRemoveExercise = async (itemId: string) => {
    const filtered = template.items.filter((item) => item.id !== itemId);
    await app.callServerTool({
      name: "update_workout_template",
      arguments: {
        templateId: template.id,
        items: itemsPayload(filtered),
      },
    });
    await refreshTemplate();
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= template.items.length) return;

    const reordered = [...template.items];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);

    await app.callServerTool({
      name: "update_workout_template",
      arguments: {
        templateId: template.id,
        items: itemsPayload(reordered),
      },
    });
    await refreshTemplate();
  };

  return (
    <div className="editor">
      <header className="header">
        <div className="header-top">
          <input
            className="name-input"
            value={editingName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Template Name"
          />
        </div>
        <div className="date-text">
          {template.items.length} exercise
          {template.items.length === 1 ? "" : "s"}
        </div>
      </header>

      <div className="exercises">
        {template.items.map((item, index) => (
          <TemplateItemRow
            key={item.id}
            item={item}
            index={index}
            total={template.items.length}
            onRemove={() => handleRemoveExercise(item.id)}
            onMoveUp={() => handleMove(index, "up")}
            onMoveDown={() => handleMove(index, "down")}
          />
        ))}
      </div>

      {isAddingExercise ? (
        <ExerciseSearch
          app={app}
          onSelectExercise={handleAddExercise}
          onCancel={() => setIsAddingExercise(false)}
        />
      ) : (
        <button
          type="button"
          className="btn btn-outline btn-full"
          onClick={() => setIsAddingExercise(true)}
        >
          + Exercise
        </button>
      )}
    </div>
  );
}

function TemplateItemRow({
  item,
  index,
  total,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  item: WorkoutTemplateItem;
  index: number;
  total: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [isBusy, setIsBusy] = useState(false);
  const equipment = item.equipment ?? item.exercise.equipment;

  const wrap = (fn: () => Promise<void> | void) => async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await fn();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-header-info">
          <span className="set-col-num">{index + 1}.</span>
          <span className="exercise-name">{item.exercise.name}</span>
          {equipment && <span className="badge">{equipment.name}</span>}
        </div>
        <div className="confirm-row">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={wrap(onMoveUp)}
            disabled={isBusy || index === 0}
            aria-label="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={wrap(onMoveDown)}
            disabled={isBusy || index === total - 1}
            aria-label="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost btn-delete"
            onClick={wrap(onRemove)}
            disabled={isBusy}
            aria-label="Remove"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
