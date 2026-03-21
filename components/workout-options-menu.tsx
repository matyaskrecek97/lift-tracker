"use client";

import { IconButton, Menu, Portal, Spinner } from "@chakra-ui/react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  createTemplateFromWorkout,
  deleteWorkout,
  duplicateWorkout,
  type Workout,
} from "@/lib/hooks";

interface WorkoutOptionsMenuProps {
  workout: Workout;
  onDeleted?: () => void;
}

export function WorkoutOptionsMenu({
  workout,
  onDeleted,
}: WorkoutOptionsMenuProps) {
  const [isBusy, setIsBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isFinished = !!workout.endedAt;

  const handleDuplicate = async () => {
    setIsBusy(true);
    try {
      const newWorkout = await duplicateWorkout(workout.id);
      window.location.href = `/workouts/${newWorkout.id}`;
    } catch {
      setIsBusy(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    setIsBusy(true);
    try {
      const template = await createTemplateFromWorkout(workout.id);
      window.location.href = `/templates/${template.id}`;
    } catch {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    setIsBusy(true);
    try {
      await deleteWorkout(workout.id);
      onDeleted?.();
    } catch {
      setIsBusy(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton
            aria-label="Workout options"
            variant="ghost"
            size="sm"
            disabled={isBusy}
            onClick={(e) => e.stopPropagation()}
          >
            {isBusy ? <Spinner size="xs" /> : "⋮"}
          </IconButton>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content minW="180px" onClick={(e) => e.stopPropagation()}>
              {isFinished && (
                <>
                  <Menu.Item value="duplicate" onClick={handleDuplicate}>
                    Duplicate
                  </Menu.Item>
                  <Menu.Item
                    value="save-as-template"
                    onClick={handleSaveAsTemplate}
                  >
                    Save as Template
                  </Menu.Item>
                </>
              )}
              {isFinished && <Menu.Separator />}
              <Menu.Item
                value="delete"
                color="fg.error"
                _hover={{ bg: "bg.error", color: "fg.error" }}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>

      <ConfirmDialog
        open={showDeleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Delete workout?"
        description="This will archive the workout. This action cannot be easily undone."
        loading={isBusy}
      />
    </>
  );
}
