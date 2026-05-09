import type { App } from "@modelcontextprotocol/ext-apps";
import { useCallback, useRef, useState } from "react";
import type {
  Exercise,
  ExerciseSuggestion,
  FindOrSuggestExerciseResult,
} from "./types";

interface Props {
  app: App;
  onSelectExercise: (exerciseId: string) => Promise<void>;
  onCancel: () => void;
}

export function ExerciseSearch({ app, onSelectExercise, onCancel }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Exercise[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<ExerciseSuggestion | null>(null);
  const [aiExercises, setAiExercises] = useState<Exercise[]>([]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (suggestion || aiError) {
      setSuggestion(null);
      setAiError(null);
    }
    clearTimeout(timerRef.current);
    if (!value.trim()) {
      setResults([]);
      setHasSearched(false);
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
        setResults(text ? JSON.parse(text) : []);
        setHasSearched(true);
      } catch (e) {
        console.error("Search failed:", e);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelect = async (exerciseId: string) => {
    if (isAdding) return;
    setIsAdding(true);
    try {
      await onSelectExercise(exerciseId);
    } catch (e) {
      console.error("Failed to add exercise:", e);
    } finally {
      setIsAdding(false);
    }
  };

  const triggerAISearch = useCallback(async () => {
    if (!query.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setSuggestion(null);
    try {
      const result = await app.callServerTool({
        name: "find_or_suggest_exercise",
        arguments: { query },
      });
      const text = result.content?.find(
        (c): c is { type: "text"; text: string } => c.type === "text",
      )?.text;
      if (!text) {
        setAiError("AI search returned no result.");
        return;
      }
      const parsed = JSON.parse(text) as FindOrSuggestExerciseResult;
      setSuggestion(parsed.suggestion);
      setAiExercises(parsed.exercises);
    } catch (e) {
      console.error("AI search failed:", e);
      setAiError("AI search failed. Please try again.");
    } finally {
      setAiLoading(false);
    }
  }, [app, query]);

  const handleConfirmSuggestion = useCallback(async () => {
    if (!suggestion || isAdding) return;
    setIsAdding(true);
    try {
      let exerciseId: string | null = null;

      if (suggestion.isExistingMatch) {
        const fromAI = aiExercises.find(
          (e) =>
            e.name === suggestion.exerciseName ||
            e.czechName === suggestion.czechName,
        );
        if (fromAI) {
          exerciseId = fromAI.id;
        } else {
          const fallback = await app.callServerTool({
            name: "search_exercises",
            arguments: { query: suggestion.exerciseName },
          });
          const text = fallback.content?.find(
            (c): c is { type: "text"; text: string } => c.type === "text",
          )?.text;
          const matches: Exercise[] = text ? JSON.parse(text) : [];
          if (matches.length > 0) exerciseId = matches[0].id;
        }
      } else {
        const created = await app.callServerTool({
          name: "create_exercise",
          arguments: {
            name: suggestion.exerciseName,
            slug: suggestion.exerciseSlug,
            czechName: suggestion.czechName,
            primaryBodyPartSlug: suggestion.primaryBodyPartSlug,
            secondaryBodyPartSlugs: suggestion.secondaryBodyPartSlugs,
            equipmentSlug: suggestion.defaultEquipmentSlug ?? undefined,
            isPublic: true,
          },
        });
        const text = created.content?.find(
          (c): c is { type: "text"; text: string } => c.type === "text",
        )?.text;
        if (text) {
          const exercise = JSON.parse(text) as Exercise;
          exerciseId = exercise.id;
        }
      }

      if (!exerciseId) {
        setAiError("Could not resolve exercise. Please try again.");
        return;
      }

      await onSelectExercise(exerciseId);
    } catch (e) {
      console.error("Failed to add suggested exercise:", e);
      setAiError("Failed to add exercise. Please try again.");
    } finally {
      setIsAdding(false);
    }
  }, [suggestion, aiExercises, app, isAdding, onSelectExercise]);

  const clearSuggestion = () => {
    setSuggestion(null);
    setAiError(null);
  };

  const showAIButton =
    !!query.trim() &&
    hasSearched &&
    !isSearching &&
    results.length === 0 &&
    !suggestion &&
    !aiLoading;

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
        <button type="button" className="btn btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>

      {isSearching && <div className="search-status">Searching...</div>}

      {aiLoading && <div className="search-status">Searching with AI...</div>}

      {suggestion && (
        <AISuggestionCard
          suggestion={suggestion}
          onConfirm={handleConfirmSuggestion}
          onTryAgain={clearSuggestion}
          disabled={isAdding}
        />
      )}

      {aiError && <div className="search-status ai-error">{aiError}</div>}

      {!suggestion && results.length > 0 && (
        <div className="search-results">
          {results.slice(0, 15).map((ex) => (
            <button
              type="button"
              key={ex.id}
              className="search-result"
              onClick={() => handleSelect(ex.id)}
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

      {showAIButton && (
        <>
          <div className="search-status">No exercises found</div>
          <button
            type="button"
            className="btn btn-sm btn-outline btn-full"
            onClick={triggerAISearch}
          >
            Search with AI
          </button>
        </>
      )}
    </div>
  );
}

function AISuggestionCard({
  suggestion,
  onConfirm,
  onTryAgain,
  disabled,
}: {
  suggestion: ExerciseSuggestion;
  onConfirm: () => void;
  onTryAgain: () => void;
  disabled: boolean;
}) {
  const confidenceClass =
    suggestion.confidence === "high"
      ? "ai-confidence-high"
      : suggestion.confidence === "medium"
        ? "ai-confidence-medium"
        : "ai-confidence-low";

  return (
    <div className="ai-suggestion">
      <div className="ai-suggestion-header">
        <span className="ai-suggestion-label">AI Suggestion</span>
        <span className={`badge badge-sm ${confidenceClass}`}>
          {suggestion.confidence.toUpperCase()}
        </span>
      </div>
      <div className="ai-suggestion-name">
        {suggestion.exerciseName}
        {suggestion.isExistingMatch && (
          <span className="badge badge-sm">Existing</span>
        )}
      </div>
      <div className="ai-suggestion-tags">
        <span className="badge badge-sm">{suggestion.primaryBodyPartSlug}</span>
        {suggestion.secondaryBodyPartSlugs.map((slug) => (
          <span key={slug} className="badge badge-sm badge-outline">
            {slug}
          </span>
        ))}
        {suggestion.defaultEquipmentSlug && (
          <span className="badge badge-sm badge-outline">
            {suggestion.defaultEquipmentSlug}
          </span>
        )}
      </div>
      <div className="ai-suggestion-actions">
        <button
          type="button"
          className="btn btn-sm"
          onClick={onTryAgain}
          disabled={disabled}
        >
          Try again
        </button>
        <button
          type="button"
          className="btn btn-sm btn-finish"
          onClick={onConfirm}
          disabled={disabled}
        >
          Add
        </button>
      </div>
    </div>
  );
}
