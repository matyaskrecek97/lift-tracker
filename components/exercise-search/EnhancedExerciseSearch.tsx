"use client";

import {
  Badge,
  Box,
  Button,
  Card,
  createListCollection,
  Flex,
  HStack,
  Input,
  Portal,
  Select,
  Separator,
  Spinner,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useMemo, useState } from "react";
import {
  addExerciseToWorkout,
  createExercise,
  type Exercise,
  type ExerciseSuggestion,
  searchExerciseWithAI,
  useDebouncedValue,
  useEquipment,
  useExercises,
} from "@/lib/hooks";

const BODY_PART_GROUPS = [
  { label: "Chest", slugs: ["chest"] },
  { label: "Back", slugs: ["back", "lats", "traps"] },
  {
    label: "Shoulders",
    slugs: ["shoulders-front", "shoulders-side", "shoulders-rear"],
  },
  { label: "Arms", slugs: ["biceps", "triceps", "forearms"] },
  { label: "Core", slugs: ["abs", "obliques", "lower-back"] },
  {
    label: "Legs",
    slugs: ["glutes", "quads", "hamstrings", "calves", "adductors"],
  },
] as const;

interface EnhancedExerciseSearchProps {
  /** If provided, exercises are added to this workout via addExerciseToWorkout. */
  workoutId?: string;
  /** Generic callback when an exercise is selected. Takes priority over workoutId-based behavior. */
  onSelectExercise?: (
    exerciseId: string,
    equipmentId?: string | null,
  ) => Promise<void>;
  /** "search" = search bar with inline AI (workout/template). "ai" = AI textarea only (exercises page). */
  variant?: "search" | "ai";
  onExerciseAdded?: () => void;
  onClose?: () => void;
}

export function EnhancedExerciseSearch({
  workoutId,
  onSelectExercise: onSelectExerciseProp,
  variant = "search",
  onExerciseAdded,
  onClose,
}: EnhancedExerciseSearchProps) {
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const activeGroup = BODY_PART_GROUPS.find((g) => g.label === selectedGroup);
  const hasFilter = !!(debouncedSearch || selectedGroup);
  const { data: exercises } = useExercises(
    variant === "search" ? debouncedSearch || undefined : undefined,
    true,
    activeGroup?.slugs as string[] | undefined,
  );
  const [isAdding, setIsAdding] = useState(false);

  // AI search state
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<ExerciseSuggestion | null>(null);
  const [aiExercises, setAiExercises] = useState<Exercise[]>([]);

  const canSelect = !!onSelectExerciseProp || !!workoutId;

  const handleSelectExercise = useCallback(
    async (exerciseId: string, equipmentId?: string | null) => {
      if (!canSelect) return;
      setIsAdding(true);
      if (onSelectExerciseProp) {
        await onSelectExerciseProp(exerciseId, equipmentId);
      } else if (workoutId) {
        await addExerciseToWorkout(workoutId, exerciseId, equipmentId);
      }
      onExerciseAdded?.();
      setIsAdding(false);
      onClose?.();
    },
    [canSelect, onSelectExerciseProp, workoutId, onExerciseAdded, onClose],
  );

  const triggerAISearch = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setSuggestion(null);
    try {
      const result = await searchExerciseWithAI(query);
      setSuggestion(result.suggestion);
      setAiExercises(result.exercises);
    } catch {
      setAiError("AI search failed. Please try again.");
    } finally {
      setAiLoading(false);
    }
  }, []);

  const handleConfirmSuggestion = useCallback(
    async (equipmentOverrideId?: string | null) => {
      if (!suggestion) return;
      setIsAdding(true);
      try {
        let exerciseId: string | null = null;

        if (suggestion.isExistingMatch) {
          const match = aiExercises.find(
            (e) => e.name === suggestion.exerciseName,
          );
          if (match) {
            exerciseId = match.id;
          } else {
            const res = await fetch(
              `/api/exercises?q=${encodeURIComponent(suggestion.exerciseName)}&includePrivate=true&limit=1`,
            );
            const found: Exercise[] = await res.json();
            if (found.length > 0) {
              exerciseId = found[0].id;
            }
          }
        } else {
          const exercise = await createExercise({
            name: suggestion.exerciseName,
            slug: suggestion.exerciseSlug,
            czechName: suggestion.czechName,
            primaryBodyPartSlug: suggestion.primaryBodyPartSlug,
            secondaryBodyPartSlugs: suggestion.secondaryBodyPartSlugs,
            equipmentSlug: suggestion.defaultEquipmentSlug ?? undefined,
            isPublic: true,
          });
          exerciseId = exercise.id;
        }

        if (exerciseId && canSelect) {
          if (onSelectExerciseProp) {
            await onSelectExerciseProp(exerciseId, equipmentOverrideId);
          } else if (workoutId) {
            await addExerciseToWorkout(
              workoutId,
              exerciseId,
              equipmentOverrideId,
            );
          }
          onExerciseAdded?.();
          onClose?.();
        } else if (!canSelect) {
          onExerciseAdded?.();
          onClose?.();
        } else {
          setAiError("Could not find the exercise. Please try again.");
        }
      } catch {
        setAiError("Failed to add exercise. Please try again.");
      } finally {
        setIsAdding(false);
      }
    },
    [
      suggestion,
      aiExercises,
      canSelect,
      onSelectExerciseProp,
      workoutId,
      onExerciseAdded,
      onClose,
    ],
  );

  const clearSuggestion = useCallback(() => {
    setSuggestion(null);
    setAiError(null);
  }, []);

  if (isAdding) {
    return (
      <Flex justify="center" py="8">
        <Spinner />
      </Flex>
    );
  }

  // "ai" variant: standalone textarea flow for Exercises page
  if (variant === "ai") {
    return (
      <AISearchMode
        query={aiQuery}
        onQueryChange={setAiQuery}
        onSearch={() => triggerAISearch(aiQuery)}
        loading={aiLoading}
        error={aiError}
        suggestion={suggestion}
        onConfirm={handleConfirmSuggestion}
        onEditSuggestion={clearSuggestion}
      />
    );
  }

  // "search" variant: search bar with inline AI for workout/template pages
  return (
    <Stack gap="4">
      <Input
        placeholder="Search exercises..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          if (suggestion || aiError) {
            setSuggestion(null);
            setAiError(null);
          }
        }}
        autoFocus
      />

      {aiLoading ? (
        <Stack gap="4" align="center" py="8">
          <Spinner size="lg" />
          <Text color="fg.muted">Searching with AI...</Text>
        </Stack>
      ) : suggestion ? (
        <AISuggestionCard
          suggestion={suggestion}
          onConfirm={handleConfirmSuggestion}
          onEditSuggestion={clearSuggestion}
          showEquipmentSelector={!!workoutId}
        />
      ) : (
        <>
          <Flex gap="2" flexWrap="wrap">
            {BODY_PART_GROUPS.map((group) => (
              <Button
                key={group.label}
                size="xs"
                variant={selectedGroup === group.label ? "solid" : "outline"}
                onClick={() =>
                  setSelectedGroup(
                    selectedGroup === group.label ? null : group.label,
                  )
                }
              >
                {group.label}
              </Button>
            ))}
          </Flex>

          <Stack gap="2" maxH="300px" minH="100px" overflowY="auto">
            {exercises &&
              exercises.length > 0 &&
              exercises.slice(0, 20).map((e) => (
                <Button
                  key={e.id}
                  variant="ghost"
                  justifyContent="flex-start"
                  onClick={() => handleSelectExercise(e.id)}
                  disabled={!canSelect}
                >
                  <HStack w="full" justify="space-between">
                    <Text>{e.name}</Text>
                    <HStack gap="1">
                      {e.primaryBodyPart && (
                        <Badge size="sm" variant="subtle">
                          {e.primaryBodyPart.name}
                        </Badge>
                      )}
                      {e.equipment && (
                        <Badge size="sm" variant="outline">
                          {e.equipment.name}
                        </Badge>
                      )}
                      {!e.isPublic && (
                        <Badge size="sm" colorPalette="purple" variant="subtle">
                          Private
                        </Badge>
                      )}
                    </HStack>
                  </HStack>
                </Button>
              ))}

            {hasFilter && exercises?.length === 0 && (
              <Text color="fg.muted" textAlign="center" py="4">
                No exercises found
              </Text>
            )}

            {!hasFilter && (!exercises || exercises.length === 0) && (
              <Text color="fg.muted" textAlign="center" py="4">
                Select a body part or type to search
              </Text>
            )}
          </Stack>

          {aiError && (
            <Text color="fg.error" textStyle="sm" textAlign="center">
              {aiError}
            </Text>
          )}

          <Separator />

          <Flex justify="center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerAISearch(search)}
              disabled={!search.trim()}
            >
              Search with AI
            </Button>
          </Flex>
        </>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// AI Search Mode (standalone textarea flow for Exercises page)
// ---------------------------------------------------------------------------

function AISearchMode({
  query,
  onQueryChange,
  onSearch,
  loading,
  error,
  suggestion,
  onConfirm,
  onEditSuggestion,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  onSearch: () => void;
  loading: boolean;
  error: string | null;
  suggestion: ExerciseSuggestion | null;
  onConfirm: (equipmentOverrideId?: string | null) => void;
  onEditSuggestion: () => void;
}) {
  if (loading) {
    return (
      <Stack gap="4" align="center" py="8">
        <Spinner size="lg" />
        <Text color="fg.muted">Standardizing exercise...</Text>
      </Stack>
    );
  }

  if (suggestion) {
    return (
      <AISuggestionCard
        suggestion={suggestion}
        onConfirm={onConfirm}
        onEditSuggestion={onEditSuggestion}
        showEquipmentSelector={false}
      />
    );
  }

  return (
    <Stack gap="4">
      <Text fontWeight="medium">Describe the exercise in your own words:</Text>
      <Textarea
        placeholder="e.g. That exercise where you lie on a bench and push the bar up, today I used bands..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        rows={3}
        autoFocus
      />

      {error && (
        <Text color="fg.error" textStyle="sm">
          {error}
        </Text>
      )}

      <Flex justify="flex-end">
        <Button
          colorPalette="blue"
          size="sm"
          onClick={onSearch}
          disabled={!query.trim()}
        >
          Add
        </Button>
      </Flex>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// AI Suggestion Card
// ---------------------------------------------------------------------------

function AISuggestionCard({
  suggestion,
  onConfirm,
  onEditSuggestion,
  showEquipmentSelector,
}: {
  suggestion: ExerciseSuggestion;
  onConfirm: (equipmentOverrideId?: string | null) => void;
  onEditSuggestion: () => void;
  showEquipmentSelector: boolean;
}) {
  const { data: equipment } = useEquipment();
  const [equipmentOverride, setEquipmentOverride] = useState<string[]>(
    suggestion.sessionEquipmentSlug ? [suggestion.sessionEquipmentSlug] : [],
  );

  const equipmentCollection = useMemo(
    () =>
      createListCollection({
        items:
          equipment?.map((eq) => ({
            label: eq.name,
            value: eq.slug,
          })) || [],
      }),
    [equipment],
  );

  const confidenceColor =
    suggestion.confidence === "high"
      ? "green"
      : suggestion.confidence === "medium"
        ? "yellow"
        : "red";

  const handleConfirm = useCallback(() => {
    const overrideSlug = equipmentOverride[0];
    if (
      overrideSlug &&
      overrideSlug !== suggestion.defaultEquipmentSlug &&
      equipment
    ) {
      const eq = equipment.find((e) => e.slug === overrideSlug);
      onConfirm(eq?.id ?? null);
    } else {
      onConfirm(null);
    }
  }, [
    equipmentOverride,
    suggestion.defaultEquipmentSlug,
    equipment,
    onConfirm,
  ]);

  return (
    <Stack gap="4">
      <Card.Root variant="outline">
        <Card.Body>
          <Stack gap="3">
            <Flex justify="space-between" align="center">
              <Text fontWeight="medium" textStyle="sm" color="fg.muted">
                AI Suggestion
              </Text>
              <Badge size="sm" colorPalette={confidenceColor} variant="subtle">
                {suggestion.confidence.toUpperCase()}
              </Badge>
            </Flex>

            <Box>
              <Text fontWeight="bold" textStyle="lg">
                {suggestion.exerciseName}
              </Text>
            </Box>

            <HStack gap="2" flexWrap="wrap">
              <Badge size="sm" variant="subtle">
                {suggestion.primaryBodyPartSlug}
              </Badge>
              {suggestion.secondaryBodyPartSlugs.map((slug) => (
                <Badge key={slug} size="sm" variant="surface">
                  {slug}
                </Badge>
              ))}
              {suggestion.defaultEquipmentSlug && (
                <Badge size="sm" variant="outline">
                  {suggestion.defaultEquipmentSlug} (default)
                </Badge>
              )}
            </HStack>

            {showEquipmentSelector && (
              <Box>
                <Text textStyle="sm" fontWeight="medium" mb="1">
                  Equipment for this session:
                </Text>
                <Select.Root
                  collection={equipmentCollection}
                  value={equipmentOverride}
                  onValueChange={(e) => setEquipmentOverride(e.value)}
                  size="sm"
                >
                  <Select.HiddenSelect />
                  <Select.Control>
                    <Select.Trigger>
                      <Select.ValueText placeholder="Use default equipment" />
                    </Select.Trigger>
                    <Select.IndicatorGroup>
                      <Select.ClearTrigger />
                      <Select.Indicator />
                    </Select.IndicatorGroup>
                  </Select.Control>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content>
                        {equipmentCollection.items.map((eq) => (
                          <Select.Item item={eq} key={eq.value}>
                            {eq.label}
                            <Select.ItemIndicator />
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                </Select.Root>
              </Box>
            )}
          </Stack>
        </Card.Body>
      </Card.Root>

      <Flex justify="flex-end">
        <HStack gap="2">
          <Button variant="outline" size="sm" onClick={onEditSuggestion}>
            Try again
          </Button>
          <Button colorPalette="blue" size="sm" onClick={handleConfirm}>
            Add
          </Button>
        </HStack>
      </Flex>
    </Stack>
  );
}
