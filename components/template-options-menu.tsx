"use client";

import { IconButton, Menu, Portal, Spinner } from "@chakra-ui/react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  createWorkout,
  deleteTemplate,
  duplicateTemplate,
  type WorkoutTemplate,
} from "@/lib/hooks";

interface TemplateOptionsMenuProps {
  template: WorkoutTemplate;
  onDeleted?: () => void;
}

export function TemplateOptionsMenu({
  template,
  onDeleted,
}: TemplateOptionsMenuProps) {
  const [isBusy, setIsBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleStartWorkout = async () => {
    setIsBusy(true);
    try {
      const workout = await createWorkout({ templateId: template.id });
      window.location.href = `/workouts/${workout.id}`;
    } catch {
      setIsBusy(false);
    }
  };

  const handleDuplicate = async () => {
    setIsBusy(true);
    try {
      const newTemplate = await duplicateTemplate(template.id);
      window.location.href = `/templates/${newTemplate.id}`;
    } catch {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    setIsBusy(true);
    try {
      await deleteTemplate(template.id);
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
            aria-label="Template options"
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
              <Menu.Item value="start-workout" onClick={handleStartWorkout}>
                Start Workout
              </Menu.Item>
              <Menu.Item value="duplicate" onClick={handleDuplicate}>
                Duplicate
              </Menu.Item>
              <Menu.Separator />
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
        title="Delete template?"
        description="This will permanently delete the template. This action cannot be undone."
        loading={isBusy}
      />
    </>
  );
}
