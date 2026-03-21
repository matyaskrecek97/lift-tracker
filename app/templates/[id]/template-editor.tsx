"use client";

import {
  Box,
  Button,
  Card,
  Flex,
  HStack,
  IconButton,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { EnhancedExerciseSearch } from "@/components/exercise-search/EnhancedExerciseSearch";
import { TemplateOptionsMenu } from "@/components/template-options-menu";
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type Exercise,
  updateTemplate,
  useDebouncedCallback,
  useTemplate,
  type WorkoutTemplate,
} from "@/lib/hooks";

export function TemplateEditor({
  template: initialTemplate,
}: {
  template: WorkoutTemplate;
}) {
  const { data: template, mutate: refreshTemplate } = useTemplate(
    initialTemplate.id,
    { fallbackData: initialTemplate },
  );
  const [templateName, setTemplateName] = useState(initialTemplate.name);
  const [showAddExercise, setShowAddExercise] = useState(false);

  const id = initialTemplate.id;

  useEffect(() => {
    if (template) {
      setTemplateName(template.name);
    }
  }, [template]);

  const handleAutoSave = useDebouncedCallback(
    async (updates: { name?: string }) => {
      if (updates.name?.trim()) {
        await updateTemplate(id, { name: updates.name.trim() });
        refreshTemplate();
      }
    },
  );

  const handleNameChange = (value: string) => {
    setTemplateName(value);
    handleAutoSave({ name: value });
  };

  const handleRemoveExercise = async (exerciseId: string) => {
    if (!template) return;
    const newItems = template.items
      .filter((item) => item.exercise.id !== exerciseId)
      .map((item, index) => ({
        exerciseId: item.exercise.id,
        equipmentId: item.equipment?.id || null,
        order: index,
      }));
    await updateTemplate(id, { items: newItems });
    refreshTemplate();
  };

  const handleAddExercise = useCallback(
    async (exerciseId: string, equipmentId?: string | null) => {
      if (!template) return;
      const newItems = [
        ...template.items.map((item) => ({
          exerciseId: item.exercise.id,
          equipmentId: item.equipment?.id || null,
          order: item.order,
        })),
        {
          exerciseId,
          equipmentId: equipmentId ?? null,
          order: template.items.length,
        },
      ];
      await updateTemplate(id, { items: newItems });
      refreshTemplate();
    },
    [template, id, refreshTemplate],
  );

  const handleMoveExercise = async (
    currentIndex: number,
    direction: "up" | "down",
  ) => {
    if (!template) return;
    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= template.items.length) return;

    const newItems = [...template.items];
    const [removed] = newItems.splice(currentIndex, 1);
    newItems.splice(newIndex, 0, removed);

    await updateTemplate(id, {
      items: newItems.map((item, index) => ({
        exerciseId: item.exercise.id,
        equipmentId: item.equipment?.id || null,
        order: index,
      })),
    });
    refreshTemplate();
  };

  if (!template) return null;

  return (
    <Stack gap="6">
      {/* Header */}
      <Box>
        <HStack gap="1" align="center">
          <Input
            value={templateName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Template Name"
            size="lg"
            fontWeight="bold"
            fontSize="xl"
            variant="flushed"
            px="0"
            flex="1"
          />
          <TemplateOptionsMenu
            template={template}
            onDeleted={() => window.location.replace("/templates")}
          />
        </HStack>
        <Text color="fg.muted" textStyle="sm">
          {template.items.length} exercise
          {template.items.length !== 1 ? "s" : ""}
        </Text>
      </Box>

      {/* Exercises List */}
      <Stack gap="3">
        <Flex justify="space-between" align="center">
          <Text fontWeight="medium" fontSize="lg">
            Exercises
          </Text>
          <Button
            colorPalette="blue"
            variant="outline"
            size="sm"
            onClick={() => setShowAddExercise(true)}
          >
            Add Exercise
          </Button>
        </Flex>

        {template.items.length === 0 ? (
          <Card.Root variant="subtle">
            <Card.Body>
              <Text color="fg.muted" textAlign="center" py="4">
                No exercises in this template. Add some to get started!
              </Text>
            </Card.Body>
          </Card.Root>
        ) : (
          <Stack gap="2">
            {template.items.map((item, index) => (
              <ExerciseRow
                key={item.id}
                exercise={item.exercise}
                index={index}
                total={template.items.length}
                onRemove={() => handleRemoveExercise(item.exercise.id)}
                onMoveUp={() => handleMoveExercise(index, "up")}
                onMoveDown={() => handleMoveExercise(index, "down")}
              />
            ))}
          </Stack>
        )}
      </Stack>

      {/* Add Exercise Dialog */}
      <AddExerciseDialog
        open={showAddExercise}
        onClose={() => setShowAddExercise(false)}
        onSelectExercise={handleAddExercise}
      />
    </Stack>
  );
}

function ExerciseRow({
  exercise,
  index,
  total,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  exercise: Exercise;
  index: number;
  total: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <Card.Root variant="outline">
      <Card.Body py="3" px="4">
        <Flex justify="space-between" align="center">
          <HStack gap="3">
            <Text color="fg.muted" fontWeight="medium" minW="6">
              {index + 1}.
            </Text>
            <Text fontWeight="medium">{exercise.name}</Text>
          </HStack>
          <HStack gap="1">
            <IconButton
              aria-label="Move up"
              variant="ghost"
              size="sm"
              onClick={onMoveUp}
              disabled={index === 0}
            >
              ↑
            </IconButton>
            <IconButton
              aria-label="Move down"
              variant="ghost"
              size="sm"
              onClick={onMoveDown}
              disabled={index === total - 1}
            >
              ↓
            </IconButton>
            <IconButton
              aria-label="Remove exercise"
              variant="ghost"
              size="sm"
              colorPalette="red"
              onClick={onRemove}
            >
              ✕
            </IconButton>
          </HStack>
        </Flex>
      </Card.Body>
    </Card.Root>
  );
}

function AddExerciseDialog({
  open,
  onClose,
  onSelectExercise,
}: {
  open: boolean;
  onClose: () => void;
  onSelectExercise: (
    exerciseId: string,
    equipmentId?: string | null,
  ) => Promise<void>;
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
            onSelectExercise={onSelectExercise}
            onClose={onClose}
          />
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}
