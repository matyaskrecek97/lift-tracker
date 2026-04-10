import type { App } from "@modelcontextprotocol/ext-apps";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from "./types";

function toNumber(value: number | string): number {
  return typeof value === "string" ? parseFloat(value) : value;
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "In progress";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

interface Props {
  app: App;
  workout: Workout;
  onWorkoutChange: (w: Workout) => void;
}

export function WorkoutEditor({ app, workout, onWorkoutChange }: Props) {
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [editingName, setEditingName] = useState(workout.name ?? "");
  const nameTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    setEditingName(workout.name ?? "");
  }, [workout.name]);

  const refreshWorkout = useCallback(async () => {
    try {
      const result = await app.callServerTool({
        name: "get_workout",
        arguments: { workoutId: workout.id },
      });
      const data = result.structuredContent as unknown as Workout | undefined;
      if (data?.id) onWorkoutChange(data);
    } catch (e) {
      console.error("Failed to refresh workout:", e);
    }
  }, [app, workout.id, onWorkoutChange]);

  const handleNameChange = (value: string) => {
    setEditingName(value);
    clearTimeout(nameTimerRef.current);
    nameTimerRef.current = setTimeout(async () => {
      try {
        await app.callServerTool({
          name: "update_workout",
          arguments: { workoutId: workout.id, name: value || null },
        });
        await refreshWorkout();
      } catch (e) {
        console.error("Failed to update name:", e);
      }
    }, 600);
  };

  const handleFinish = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await app.callServerTool({
        name: "finish_workout",
        arguments: { workoutId: workout.id },
      });
      await refreshWorkout();
    } catch (e) {
      console.error("Failed to finish workout:", e);
    } finally {
      setIsBusy(false);
    }
  };

  const stats = useMemo(() => {
    let totalVolume = 0;
    let totalSets = 0;
    let totalReps = 0;

    for (const ex of workout.exercises) {
      for (const set of ex.sets) {
        if (!set.isWarmup) {
          const w = toNumber(set.weightKg);
          totalVolume += w * set.reps;
          totalSets++;
          totalReps += set.reps;
        }
      }
    }

    let durationMinutes: number | null = null;
    if (workout.endedAt) {
      const start = new Date(workout.startedAt).getTime();
      const end = new Date(workout.endedAt).getTime();
      durationMinutes = Math.round((end - start) / 1000 / 60);
    }

    return {
      totalVolume: Math.round(totalVolume),
      totalSets,
      totalReps,
      durationMinutes,
    };
  }, [workout]);

  const isActive = !workout.endedAt;

  return (
    <div className="editor">
      <header className="header">
        <div className="header-top">
          <input
            className="name-input"
            value={editingName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={
              isActive ? "Workout Name (optional)" : "Untitled Workout"
            }
          />
          {isActive && (
            <button
              type="button"
              className="btn btn-finish"
              onClick={handleFinish}
              disabled={isBusy}
            >
              Finish
            </button>
          )}
        </div>
        <div className="date-text">
          {new Date(workout.startedAt).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
          {workout.endedAt && (
            <>
              {" "}
              —{" "}
              {new Date(workout.endedAt).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </>
          )}
        </div>
      </header>

      <div className="stats-row">
        <div className="stat">
          <span className="stat-value">
            {stats.totalVolume > 0
              ? `${stats.totalVolume.toLocaleString()} kg`
              : "—"}
          </span>
          <span className="stat-label">Volume</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {stats.totalSets > 0 ? stats.totalSets : "—"}
          </span>
          <span className="stat-label">Sets</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {stats.totalReps > 0 ? stats.totalReps : "—"}
          </span>
          <span className="stat-label">Reps</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {formatDuration(stats.durationMinutes)}
          </span>
          <span className="stat-label">Duration</span>
        </div>
      </div>

      <div className="exercises">
        {workout.exercises.map((ex) => (
          <ExerciseCard
            key={ex.id}
            app={app}
            workoutId={workout.id}
            exercise={ex}
            onRefresh={refreshWorkout}
          />
        ))}
      </div>

      {isAddingExercise ? (
        <ExerciseSearch
          app={app}
          workoutId={workout.id}
          onDone={() => {
            setIsAddingExercise(false);
            refreshWorkout();
          }}
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

function ExerciseCard({
  app,
  workoutId,
  exercise,
  onRefresh,
}: {
  app: App;
  workoutId: string;
  exercise: WorkoutExercise;
  onRefresh: () => Promise<void>;
}) {
  const [isBusy, setIsBusy] = useState(false);
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);
  const currentEquipment = exercise.equipment ?? exercise.exercise.equipment;

  const handleAddSet = async () => {
    if (isBusy) return;
    setIsBusy(true);
    const lastSet = exercise.sets[exercise.sets.length - 1];
    try {
      await app.callServerTool({
        name: "log_set",
        arguments: {
          workoutExerciseId: exercise.id,
          reps: lastSet?.reps ?? 1,
          weightKg: lastSet ? toNumber(lastSet.weightKg) : 0,
        },
      });
      await onRefresh();
    } catch (e) {
      console.error("Failed to add set:", e);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemove = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await app.callServerTool({
        name: "remove_exercise_from_workout",
        arguments: { workoutId, workoutExerciseId: exercise.id },
      });
      await onRefresh();
    } catch (e) {
      console.error("Failed to remove exercise:", e);
    } finally {
      setIsBusy(false);
      setShowConfirmRemove(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-header-info">
          <span className="exercise-name">{exercise.exercise.name}</span>
          {currentEquipment && (
            <span className="badge">{currentEquipment.name}</span>
          )}
        </div>
        {showConfirmRemove ? (
          <div className="confirm-row">
            <span className="confirm-text">Remove?</span>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={handleRemove}
              disabled={isBusy}
            >
              Yes
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setShowConfirmRemove(false)}
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              if (exercise.sets.length === 0) handleRemove();
              else setShowConfirmRemove(true);
            }}
            disabled={isBusy}
          >
            ✕
          </button>
        )}
      </div>

      {exercise.sets.length > 0 && (
        <div className="sets-table">
          <div className="sets-header">
            <span className="set-col-num">SET</span>
            <span className="set-col-weight">WEIGHT (kg)</span>
            <span className="set-col-reps">REPS</span>
            <span className="set-col-action" />
          </div>
          {(() => {
            let workingNum = 0;
            return exercise.sets.map((set) => {
              if (!set.isWarmup) workingNum++;
              return (
                <SetRow
                  key={set.id}
                  app={app}
                  workoutExerciseId={exercise.id}
                  set={set}
                  displayNum={set.isWarmup ? "W" : String(workingNum)}
                  onRefresh={onRefresh}
                />
              );
            });
          })()}
        </div>
      )}

      <button
        type="button"
        className="btn btn-sm btn-ghost btn-add-set"
        onClick={handleAddSet}
        disabled={isBusy}
      >
        + Set
      </button>
    </div>
  );
}

function SetRow({
  app,
  workoutExerciseId,
  set,
  displayNum,
  onRefresh,
}: {
  app: App;
  workoutExerciseId: string;
  set: WorkoutSet;
  displayNum: string;
  onRefresh: () => Promise<void>;
}) {
  const weight = toNumber(set.weightKg);
  const [reps, setReps] = useState(String(set.reps));
  const [weightKg, setWeightKg] = useState(String(weight));
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setReps(String(set.reps));
    setWeightKg(String(toNumber(set.weightKg)));
  }, [set.reps, set.weightKg]);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const scheduleUpdate = (newReps: string, newWeight: string) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const r = parseInt(newReps, 10) || set.reps;
      const w = parseFloat(newWeight) || weight;
      if (r === set.reps && w === weight) return;
      try {
        await app.callServerTool({
          name: "update_set",
          arguments: {
            workoutExerciseId,
            setId: set.id,
            reps: r,
            weightKg: w,
          },
        });
        await onRefresh();
      } catch (e) {
        console.error("Failed to update set:", e);
      }
    }, 500);
  };

  const handleDelete = async () => {
    try {
      await app.callServerTool({
        name: "delete_set",
        arguments: { workoutExerciseId, setId: set.id },
      });
      await onRefresh();
    } catch (e) {
      console.error("Failed to delete set:", e);
    }
  };

  return (
    <div className="set-row">
      <span className={`set-col-num ${set.isWarmup ? "warmup" : ""}`}>
        {displayNum}
      </span>
      <input
        className="set-input set-col-weight"
        type="number"
        step="0.25"
        value={weightKg}
        onChange={(e) => {
          setWeightKg(e.target.value);
          scheduleUpdate(reps, e.target.value);
        }}
      />
      <input
        className="set-input set-col-reps"
        type="number"
        value={reps}
        onChange={(e) => {
          setReps(e.target.value);
          scheduleUpdate(e.target.value, weightKg);
        }}
      />
      <button
        type="button"
        className="btn btn-sm btn-ghost btn-delete"
        onClick={handleDelete}
      >
        ✕
      </button>
    </div>
  );
}

function ExerciseSearch({
  app,
  workoutId,
  onDone,
}: {
  app: App;
  workoutId: string;
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Exercise[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleSearch = (value: string) => {
    setQuery(value);
    clearTimeout(timerRef.current);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await app.callServerTool({
          name: "search_exercises",
          arguments: { query: value },
        });
        const text = result.content?.find(
          (c): c is { type: "text"; text: string } => c.type === "text",
        )?.text;
        if (text) setResults(JSON.parse(text));
      } catch (e) {
        console.error("Search failed:", e);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelect = async (exercise: Exercise) => {
    if (isAdding) return;
    setIsAdding(true);
    try {
      await app.callServerTool({
        name: "add_exercise_to_workout",
        arguments: { workoutId, exerciseId: exercise.id },
      });
      onDone();
    } catch (e) {
      console.error("Failed to add exercise:", e);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="search-panel">
      <div className="search-header">
        <input
          className="search-input"
          placeholder="Search exercises..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          ref={(el) => el?.focus()}
        />
        <button type="button" className="btn btn-sm" onClick={onDone}>
          Cancel
        </button>
      </div>
      {isSearching && <div className="search-status">Searching...</div>}
      {results.length > 0 && (
        <div className="search-results">
          {results.slice(0, 15).map((ex) => (
            <button
              type="button"
              key={ex.id}
              className="search-result"
              onClick={() => handleSelect(ex)}
              disabled={isAdding}
            >
              <span className="search-result-name">{ex.name}</span>
              {ex.primaryBodyPart && (
                <span className="badge badge-sm">
                  {ex.primaryBodyPart.name}
                </span>
              )}
              {ex.equipment && (
                <span className="badge badge-sm badge-outline">
                  {ex.equipment.name}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {!isSearching && query.trim() && results.length === 0 && (
        <div className="search-status">No exercises found</div>
      )}
    </div>
  );
}
