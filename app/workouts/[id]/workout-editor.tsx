"use client";

import {
  Badge,
  Box,
  Button,
  Card,
  createListCollection,
  Flex,
  HStack,
  IconButton,
  Input,
  Menu,
  Popover,
  Portal,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { EnhancedExerciseSearch } from "@/components/exercise-search/EnhancedExerciseSearch";
import { StatCard } from "@/components/stat-card";
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { WorkoutOptionsMenu } from "@/components/workout-options-menu";
import {
  addSet,
  createPlace,
  deletePlace,
  deleteSet,
  type Place,
  removeExerciseFromWorkout,
  updatePlace,
  updateSet,
  updateWorkout,
  updateWorkoutExercise,
  useDebouncedCallback,
  useEquipment,
  useExerciseHistory,
  usePlaces,
  useWorkout,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from "@/lib/hooks";
import { formatDateTimeForInput, formatDuration, toNumber } from "@/lib/utils";

function calculateWorkoutStats(workout: {
  startedAt: string;
  endedAt: string | null;
  exercises: WorkoutExercise[];
}) {
  let totalVolume = 0;
  let totalSets = 0;
  let totalReps = 0;
  let heaviestLift = 0;

  for (const exercise of workout.exercises) {
    for (const set of exercise.sets) {
      if (!set.isWarmup) {
        const weight = toNumber(set.weightKg);
        totalVolume += weight * set.reps;
        totalSets++;
        totalReps += set.reps;
        if (weight > heaviestLift) {
          heaviestLift = weight;
        }
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
    heaviestLift,
    durationMinutes,
    exerciseCount: workout.exercises.length,
  };
}

export function WorkoutEditor({
  initialWorkout,
  initialPlaces,
}: {
  initialWorkout: Workout;
  initialPlaces: Place[];
}) {
  const id = initialWorkout.id;
  const router = useRouter();
  const {
    data: workout,
    isLoading,
    mutate: refreshWorkout,
  } = useWorkout(id, { fallbackData: initialWorkout });
  const { data: places, mutate: refreshPlaces } = usePlaces();
  const exerciseIds = useMemo(
    () => workout?.exercises.map((e) => e.exercise.id) ?? [],
    [workout?.exercises],
  );
  const equipmentByExercise = useMemo(() => {
    if (!workout?.exercises.length) return undefined;
    const map: Record<string, string | null> = {};
    for (const ex of workout.exercises) {
      const eqId = ex.equipment?.id ?? ex.exercise.equipment?.id ?? null;
      map[ex.exercise.id] = eqId;
    }
    return map;
  }, [workout?.exercises]);
  const { data: exerciseHistory } = useExerciseHistory(
    exerciseIds,
    id,
    equipmentByExercise,
  );
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [placeId, setPlaceId] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [workoutName, setWorkoutName] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [endedAt, setEndedAt] = useState("");
  const dirtyFieldsRef = useRef<Set<string>>(new Set());

  // Place management state
  const [isManagingPlaces, setIsManagingPlaces] = useState(false);
  const [newPlaceName, setNewPlaceName] = useState("");
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
  const [editingPlaceName, setEditingPlaceName] = useState("");

  const activePlaces = places ?? initialPlaces;

  const placesCollection = useMemo(
    () =>
      createListCollection({
        items: activePlaces?.map((p) => ({ label: p.name, value: p.id })) || [],
      }),
    [activePlaces],
  );

  useEffect(() => {
    if (workout) {
      setPlaceId(workout.place?.id ? [workout.place.id] : []);
      if (!dirtyFieldsRef.current.has("notes")) {
        setNotes(workout.notes || "");
      }
      if (!dirtyFieldsRef.current.has("name")) {
        setWorkoutName(workout.name || "");
      }
      setStartedAt(formatDateTimeForInput(new Date(workout.startedAt)));
      setEndedAt(
        workout.endedAt
          ? formatDateTimeForInput(new Date(workout.endedAt))
          : "",
      );
      dirtyFieldsRef.current.clear();
    }
  }, [workout]);

  const handleFinishWorkout = async () => {
    if (!workout) return;
    const updates: { endedAt: Date; name?: string } = { endedAt: new Date() };
    if (!workout.name && workout.exercises.length > 0) {
      updates.name = workout.exercises
        .slice(0, 3)
        .map((e) => e.exercise.name)
        .join(", ");
    }
    await updateWorkout(id, updates);
    router.push("/");
  };

  const handleAutoSave = useDebouncedCallback(
    async (updates: {
      placeId?: string | null;
      notes?: string;
      name?: string;
      startedAt?: string;
      endedAt?: string | null;
    }) => {
      const data: {
        placeId?: string | null;
        notes?: string | null;
        name?: string | null;
        startedAt?: Date;
        endedAt?: Date | null;
      } = {};

      if (updates.placeId !== undefined) {
        data.placeId = updates.placeId;
      }
      if (updates.notes !== undefined) {
        data.notes = updates.notes || null;
      }
      if (updates.name !== undefined) {
        data.name = updates.name || null;
      }
      if (updates.startedAt !== undefined) {
        data.startedAt = new Date(updates.startedAt);
      }
      if (updates.endedAt !== undefined) {
        data.endedAt = updates.endedAt ? new Date(updates.endedAt) : null;
      }

      await updateWorkout(id, data);
      refreshWorkout();
    },
  );

  const handlePlaceChange = (value: string[]) => {
    setPlaceId(value);
    handleAutoSave({ placeId: value[0] || null });
  };

  const handleNotesChange = (value: string) => {
    dirtyFieldsRef.current.add("notes");
    setNotes(value);
    handleAutoSave({ notes: value });
  };

  const handleNameChange = (value: string) => {
    dirtyFieldsRef.current.add("name");
    setWorkoutName(value);
    handleAutoSave({ name: value });
  };

  const handleStartedAtChange = (value: string) => {
    setStartedAt(value);
    if (value) {
      handleAutoSave({ startedAt: value });
    }
  };

  const handleEndedAtChange = (value: string) => {
    setEndedAt(value);
    handleAutoSave({ endedAt: value || null });
  };

  const handleCreatePlace = async () => {
    if (!newPlaceName.trim()) return;
    const place = await createPlace(newPlaceName.trim());
    refreshPlaces();
    setNewPlaceName("");
    setPlaceId([place.id]);
    handleAutoSave({ placeId: place.id });
  };

  const handleUpdatePlace = async (placeIdToUpdate: string) => {
    if (!editingPlaceName.trim()) return;
    await updatePlace(placeIdToUpdate, { name: editingPlaceName.trim() });
    refreshPlaces();
    refreshWorkout();
    setEditingPlaceId(null);
    setEditingPlaceName("");
  };

  const handleDeletePlace = async (placeIdToDelete: string) => {
    await deletePlace(placeIdToDelete);
    refreshPlaces();
    if (placeId[0] === placeIdToDelete) {
      setPlaceId([]);
      handleAutoSave({ placeId: null });
    }
  };

  if (isLoading && !workout) {
    return (
      <Flex justify="center" py="20">
        <Spinner size="xl" />
      </Flex>
    );
  }

  if (!workout) {
    return <Text>Workout not found</Text>;
  }

  const isActive = !workout.endedAt;

  return (
    <Stack gap="6">
      <Flex
        direction={{ base: "column", md: "row" }}
        justify={{ base: "flex-start", md: "space-between" }}
        align={{ base: "stretch", md: "center" }}
        gap="4"
      >
        <Box flex="1" minW="0">
          <HStack gap="1" align="center">
            <Input
              value={workoutName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={
                isActive ? "Workout Name (optional)" : "Untitled Workout"
              }
              size="lg"
              fontWeight="bold"
              fontSize="xl"
              variant="flushed"
              px="0"
              flex="1"
            />
            <WorkoutOptionsMenu
              workout={workout}
              onDeleted={() => window.location.replace("/")}
            />
          </HStack>
          <Text color="fg.muted" textStyle="sm">
            {new Date(workout.startedAt).toLocaleDateString(undefined, {
              weekday: "long",
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
          </Text>
        </Box>
        <HStack gap="2" justify={{ base: "flex-end", md: "flex-end" }}>
          {isActive && (
            <Button colorPalette="green" onClick={handleFinishWorkout}>
              Finish Workout
            </Button>
          )}
        </HStack>
      </Flex>

      {/* Quick Stats */}
      <WorkoutStatsGrid workout={workout} />

      <Card.Root>
        <Card.Body>
          <Stack gap="4">
            <Box>
              <Flex justify="space-between" align="center" mb="2">
                <Text fontWeight="medium">Location</Text>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setIsManagingPlaces(!isManagingPlaces)}
                >
                  {isManagingPlaces ? "Done" : "Manage"}
                </Button>
              </Flex>
              <Select.Root
                collection={placesCollection}
                value={placeId}
                onValueChange={(e) => handlePlaceChange(e.value)}
                size="sm"
              >
                <Select.HiddenSelect />
                <Select.Control>
                  <Select.Trigger>
                    <Select.ValueText placeholder="Select a place" />
                  </Select.Trigger>
                  <Select.IndicatorGroup>
                    <Select.ClearTrigger />
                    <Select.Indicator />
                  </Select.IndicatorGroup>
                </Select.Control>
                <Portal>
                  <Select.Positioner>
                    <Select.Content>
                      {placesCollection.items.map((place) => (
                        <Select.Item item={place} key={place.value}>
                          {place.label}
                          <Select.ItemIndicator />
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Positioner>
                </Portal>
              </Select.Root>

              {isManagingPlaces && (
                <Stack gap="2" mt="3" p="3" bg="bg.subtle" borderRadius="md">
                  <HStack>
                    <Input
                      size="sm"
                      placeholder="New place name..."
                      value={newPlaceName}
                      onChange={(e) => setNewPlaceName(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleCreatePlace()
                      }
                    />
                    <Button
                      size="sm"
                      colorPalette="blue"
                      onClick={handleCreatePlace}
                      disabled={!newPlaceName.trim()}
                    >
                      Create
                    </Button>
                  </HStack>
                  {activePlaces && activePlaces.length > 0 && (
                    <Stack gap="1" mt="2">
                      <Text textStyle="xs" color="fg.muted" fontWeight="medium">
                        EXISTING PLACES
                      </Text>
                      {activePlaces.map((place) => (
                        <HStack key={place.id} justify="space-between">
                          {editingPlaceId === place.id ? (
                            <>
                              <Input
                                size="sm"
                                flex="1"
                                value={editingPlaceName}
                                onChange={(e) =>
                                  setEditingPlaceName(e.target.value)
                                }
                                onKeyDown={(e) =>
                                  e.key === "Enter" &&
                                  handleUpdatePlace(place.id)
                                }
                                autoFocus
                              />
                              <HStack gap="1">
                                <Button
                                  size="xs"
                                  colorPalette="blue"
                                  onClick={() => handleUpdatePlace(place.id)}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingPlaceId(null);
                                    setEditingPlaceName("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </HStack>
                            </>
                          ) : (
                            <>
                              <Text textStyle="sm">{place.name}</Text>
                              <HStack gap="1">
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingPlaceId(place.id);
                                    setEditingPlaceName(place.name);
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  colorPalette="red"
                                  onClick={() => handleDeletePlace(place.id)}
                                >
                                  Delete
                                </Button>
                              </HStack>
                            </>
                          )}
                        </HStack>
                      ))}
                    </Stack>
                  )}
                </Stack>
              )}
            </Box>

            <Box>
              <Text fontWeight="medium" mb="2">
                Notes
              </Text>
              <Textarea
                placeholder="Add notes about this workout..."
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                rows={3}
                maxLength={500}
              />
            </Box>

            {/* Date/Time Editing */}
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
              <Box>
                <Text fontWeight="medium" mb="2">
                  Started At
                </Text>
                <Input
                  type="datetime-local"
                  value={startedAt}
                  onChange={(e) => handleStartedAtChange(e.target.value)}
                  size="sm"
                />
              </Box>
              <Box>
                <Text fontWeight="medium" mb="2">
                  Ended At
                </Text>
                <HStack>
                  <Input
                    type="datetime-local"
                    value={endedAt}
                    onChange={(e) => handleEndedAtChange(e.target.value)}
                    size="sm"
                    flex="1"
                  />
                  {endedAt && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEndedAtChange("")}
                    >
                      Clear
                    </Button>
                  )}
                </HStack>
              </Box>
            </SimpleGrid>
          </Stack>
        </Card.Body>
      </Card.Root>

      <Stack gap="4">
        {workout.exercises.map((exercise, index) => (
          <ExerciseCard
            key={exercise.id}
            workoutId={id}
            exercise={exercise}
            index={index}
            total={workout.exercises.length}
            allExercises={workout.exercises}
            onRefresh={refreshWorkout}
            lastSet={exerciseHistory?.[exercise.exercise.id] ?? undefined}
          />
        ))}
      </Stack>

      <Button
        variant="outline"
        size="lg"
        onClick={() => setIsAddingExercise(true)}
      >
        + Exercise
      </Button>

      <AddExerciseDialog
        open={isAddingExercise}
        onClose={() => setIsAddingExercise(false)}
        workoutId={id}
        onAdd={refreshWorkout}
      />
    </Stack>
  );
}

function WorkoutStatsGrid({ workout }: { workout: Workout }) {
  const stats = useMemo(() => calculateWorkoutStats(workout), [workout]);

  return (
    <SimpleGrid columns={{ base: 2, md: 4 }} gap="4">
      <StatCard
        label="Total Volume"
        valueTextStyle="xl"
        value={
          stats.totalVolume > 0
            ? `${stats.totalVolume.toLocaleString()} kg`
            : "—"
        }
      />
      <StatCard
        label="Working Sets"
        valueTextStyle="xl"
        value={stats.totalSets > 0 ? stats.totalSets.toString() : "—"}
      />
      <StatCard
        label="Total Reps"
        valueTextStyle="xl"
        value={stats.totalReps > 0 ? stats.totalReps.toString() : "—"}
      />
      <StatCard
        label="Duration"
        valueTextStyle="xl"
        value={formatDuration(stats.durationMinutes)}
      />
    </SimpleGrid>
  );
}

function ExerciseCard({
  workoutId,
  exercise,
  index,
  total,
  allExercises,
  onRefresh,
  lastSet,
}: {
  workoutId: string;
  exercise: WorkoutExercise;
  index: number;
  total: number;
  allExercises: WorkoutExercise[];
  onRefresh: () => void;
  lastSet?: { reps: number; weight: number } | null;
}) {
  const [isReplacing, setIsReplacing] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const exerciseName = exercise.exercise.name;
  const currentEquipment = exercise.equipment ?? exercise.exercise.equipment;

  const withBusy = async (fn: () => Promise<void>) => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await fn();
    } finally {
      setIsBusy(false);
    }
  };

  const handleReplace = async (
    newExerciseId: string,
    equipmentId?: string | null,
  ) => {
    await withBusy(async () => {
      await updateWorkoutExercise(workoutId, exercise.id, {
        exerciseId: newExerciseId,
        equipmentId: equipmentId ?? null,
      });
      onRefresh();
      setIsReplacing(false);
    });
  };

  const handleRemove = async () => {
    await withBusy(async () => {
      await removeExerciseFromWorkout(workoutId, exercise.id);
      onRefresh();
    });
  };

  const handleMove = async (direction: "up" | "down") => {
    await withBusy(async () => {
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= total) return;

      const targetExercise = allExercises[newIndex];
      await Promise.all([
        updateWorkoutExercise(workoutId, exercise.id, { order: newIndex }),
        updateWorkoutExercise(workoutId, targetExercise.id, { order: index }),
      ]);
      onRefresh();
    });
  };

  const handleEquipmentChange = async (equipmentId: string | null) => {
    await withBusy(async () => {
      await updateWorkoutExercise(workoutId, exercise.id, { equipmentId });
      onRefresh();
    });
  };

  return (
    <Card.Root>
      <Card.Header pb="2">
        <Flex justify="space-between" align="center">
          <Stack gap="1" alignItems="start" minW="0" flex="1">
            <Card.Title truncate>{exerciseName}</Card.Title>
            <HStack gap="2">
              <EquipmentSelector
                currentEquipment={currentEquipment}
                onSelect={handleEquipmentChange}
              />
              {lastSet && (
                <Text textStyle="xs" color="fg.muted">
                  Last: {lastSet.weight}kg × {lastSet.reps}
                </Text>
              )}
            </HStack>
          </Stack>
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton
                aria-label="Exercise options"
                variant="ghost"
                size="sm"
                ml="2"
                disabled={isBusy}
              >
                {isBusy ? <Spinner size="xs" /> : "⋮"}
              </IconButton>
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content minW="160px">
                  <Menu.Item
                    value="replace"
                    onClick={() => setIsReplacing(true)}
                  >
                    Replace
                  </Menu.Item>
                  {index > 0 && (
                    <Menu.Item value="move-up" onClick={() => handleMove("up")}>
                      Move up
                    </Menu.Item>
                  )}
                  {index < total - 1 && (
                    <Menu.Item
                      value="move-down"
                      onClick={() => handleMove("down")}
                    >
                      Move down
                    </Menu.Item>
                  )}
                  <Menu.Separator />
                  <Menu.Item
                    value="remove"
                    color="fg.error"
                    _hover={{ bg: "bg.error", color: "fg.error" }}
                    onClick={() => {
                      if (exercise.sets.length === 0) {
                        handleRemove();
                      } else {
                        setShowRemoveConfirm(true);
                      }
                    }}
                  >
                    Remove
                  </Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
        </Flex>
        {showRemoveConfirm && (
          <HStack mt="2" justify="flex-end" gap="2">
            <Text textStyle="sm" color="fg.muted">
              Remove exercise and all sets?
            </Text>
            <Button
              size="xs"
              colorPalette="red"
              onClick={() => {
                handleRemove();
                setShowRemoveConfirm(false);
              }}
            >
              Remove
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setShowRemoveConfirm(false)}
            >
              Cancel
            </Button>
          </HStack>
        )}
      </Card.Header>
      <Card.Body pt="0">
        <Stack gap="3">
          {exercise.sets.length > 0 && (
            <Box>
              <HStack
                textStyle="xs"
                color="fg.muted"
                fontWeight="medium"
                mb="2"
                px="2"
              >
                <Text w="12" textAlign="center">
                  SET
                </Text>
                <Text flex="1" textAlign="center">
                  WEIGHT (kg)
                </Text>
                <Text flex="1" textAlign="center">
                  REPS
                </Text>
                <Box w="8" />
              </HStack>
              <Stack gap="2">
                {(() => {
                  let workingSetNum = 0;
                  return exercise.sets.map((set, i) => {
                    if (!set.isWarmup) workingSetNum++;
                    const canToggleWarmup = set.isWarmup
                      ? i === exercise.sets.length - 1 ||
                        !exercise.sets[i + 1].isWarmup
                      : i === 0 || exercise.sets[i - 1].isWarmup;
                    return (
                      <SetRow
                        key={set.id}
                        workoutId={workoutId}
                        exerciseId={exercise.id}
                        set={set}
                        setNumber={set.isWarmup ? 0 : workingSetNum}
                        canToggleWarmup={canToggleWarmup}
                        onUpdate={onRefresh}
                      />
                    );
                  });
                })()}
              </Stack>
            </Box>
          )}
          <AddSetRow
            workoutId={workoutId}
            exerciseId={exercise.id}
            lastSet={exercise.sets[exercise.sets.length - 1]}
            onAdd={onRefresh}
          />
        </Stack>
      </Card.Body>
      <ReplaceExerciseDialog
        open={isReplacing}
        onClose={() => setIsReplacing(false)}
        onReplace={handleReplace}
      />
    </Card.Root>
  );
}

function ReplaceExerciseDialog({
  open,
  onClose,
  onReplace,
}: {
  open: boolean;
  onClose: () => void;
  onReplace: (exerciseId: string, equipmentId?: string | null) => Promise<void>;
}) {
  return (
    <DialogRoot open={open} onOpenChange={(e) => !e.open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace Exercise</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>
        <DialogBody pb="6">
          <EnhancedExerciseSearch
            onSelectExercise={async (exerciseId, equipmentId) => {
              await onReplace(exerciseId, equipmentId);
            }}
            onExerciseAdded={onClose}
            onClose={onClose}
          />
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}

function EquipmentSelector({
  currentEquipment,
  onSelect,
}: {
  currentEquipment: {
    id: string;
    name: string;
    czechName: string | null;
  } | null;
  onSelect: (equipmentId: string | null) => void;
}) {
  const { data: allEquipment } = useEquipment();
  const [open, setOpen] = useState(false);

  const handleSelect = (equipmentId: string | null) => {
    onSelect(equipmentId);
    setOpen(false);
  };

  const label = currentEquipment ? currentEquipment.name : "No equipment";

  return (
    <Popover.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
      <Popover.Trigger asChild>
        <Badge
          size="sm"
          variant={currentEquipment ? "outline" : "surface"}
          cursor="pointer"
          _hover={{ opacity: 0.8 }}
        >
          {label} ▾
        </Badge>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content maxH="300px" w="220px">
            <Popover.Body p="2">
              <Stack gap="1" overflow="auto" maxH="220px">
                <Button
                  variant={!currentEquipment ? "subtle" : "ghost"}
                  size="xs"
                  justifyContent="start"
                  onClick={() => handleSelect(null)}
                >
                  None
                </Button>
                {allEquipment?.map((eq) => (
                  <Button
                    key={eq.id}
                    variant={
                      currentEquipment?.id === eq.id ? "subtle" : "ghost"
                    }
                    size="xs"
                    justifyContent="start"
                    onClick={() => handleSelect(eq.id)}
                  >
                    {eq.name}
                    {!eq.isPublic && (
                      <Badge size="xs" ml="auto">
                        custom
                      </Badge>
                    )}
                  </Button>
                ))}
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}

function SetRow({
  workoutId,
  exerciseId,
  set,
  setNumber,
  canToggleWarmup,
  onUpdate,
}: {
  workoutId: string;
  exerciseId: string;
  set: WorkoutSet;
  setNumber: number;
  canToggleWarmup: boolean;
  onUpdate: () => void;
}) {
  const weight =
    typeof set.weightKg === "string" ? parseFloat(set.weightKg) : set.weightKg;
  const [reps, setReps] = useState(set.reps.toString());
  const [weightKg, setWeightKg] = useState(weight.toString());

  const handleUpdate = useDebouncedCallback(
    async (newReps: string, newWeight: string) => {
      const r = parseInt(newReps, 10) || set.reps;
      const w = parseFloat(newWeight) || weight;
      if (r !== set.reps || w !== weight) {
        await updateSet(workoutId, exerciseId, set.id, {
          reps: r,
          weightKg: w,
        });
        onUpdate();
      }
    },
  );

  const handleDelete = async () => {
    await deleteSet(workoutId, exerciseId, set.id);
    onUpdate();
  };

  const handleToggleWarmup = async () => {
    if (!canToggleWarmup) return;
    await updateSet(workoutId, exerciseId, set.id, {
      isWarmup: !set.isWarmup,
    });
    onUpdate();
  };

  return (
    <HStack px="2">
      <Box
        as={canToggleWarmup ? "button" : "span"}
        w="12"
        textStyle="sm"
        fontWeight="medium"
        textAlign="center"
        cursor={canToggleWarmup ? "pointer" : "default"}
        opacity={canToggleWarmup ? 1 : 0.6}
        onClick={handleToggleWarmup}
        aria-label={canToggleWarmup ? "Toggle warmup set" : undefined}
      >
        {set.isWarmup ? (
          <Badge size="sm" colorPalette="orange">
            W
          </Badge>
        ) : (
          setNumber
        )}
      </Box>
      <Input
        flex="1"
        size="sm"
        type="number"
        step="0.25"
        value={weightKg}
        textAlign="center"
        autoComplete="off"
        onChange={(e) => {
          setWeightKg(e.target.value);
          handleUpdate(reps, e.target.value);
        }}
      />
      <Input
        flex="1"
        size="sm"
        type="number"
        value={reps}
        textAlign="center"
        autoComplete="off"
        onChange={(e) => {
          setReps(e.target.value);
          handleUpdate(e.target.value, weightKg);
        }}
      />
      <IconButton
        aria-label="Delete set"
        variant="ghost"
        size="sm"
        colorPalette="red"
        onClick={handleDelete}
      >
        ✕
      </IconButton>
    </HStack>
  );
}

function AddSetRow({
  workoutId,
  exerciseId,
  lastSet,
  onAdd,
}: {
  workoutId: string;
  exerciseId: string;
  lastSet?: WorkoutSet;
  onAdd: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async () => {
    const reps = lastSet?.reps ?? 1;
    const weightKg = lastSet
      ? typeof lastSet.weightKg === "string"
        ? parseFloat(lastSet.weightKg)
        : lastSet.weightKg
      : 0;

    setIsSubmitting(true);
    await addSet(workoutId, exerciseId, { reps, weightKg });
    onAdd();
    setIsSubmitting(false);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      alignSelf="center"
      onClick={handleAdd}
      disabled={isSubmitting}
    >
      + Set
    </Button>
  );
}

function AddExerciseDialog({
  open,
  onClose,
  workoutId,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  workoutId: string;
  onAdd: () => void;
}) {
  return (
    <DialogRoot open={open} onOpenChange={(e) => !e.open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Exercise</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>
        <DialogBody pb="6">
          <EnhancedExerciseSearch
            workoutId={workoutId}
            onExerciseAdded={onAdd}
            onClose={onClose}
          />
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}
