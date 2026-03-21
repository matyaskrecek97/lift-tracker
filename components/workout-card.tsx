"use client";

import { Badge, Card, HStack, Text } from "@chakra-ui/react";
import { useMemo } from "react";
import { WorkoutOptionsMenu } from "@/components/workout-options-menu";
import type { Workout } from "@/lib/hooks";
import { formatDuration } from "@/lib/utils";

export function WorkoutCard({
  workout,
  onClick,
  onDeleted,
  isActive,
}: {
  workout: Workout;
  onClick: () => void;
  onDeleted: () => void;
  isActive?: boolean;
}) {
  const totalSets = useMemo(
    () => workout.exercises.reduce((sum, e) => sum + e.sets.length, 0),
    [workout.exercises],
  );
  const totalVolume = useMemo(
    () =>
      workout.exercises.reduce(
        (sum, e) =>
          sum +
          e.sets.reduce((setSum, s) => {
            const weight =
              typeof s.weightKg === "string"
                ? parseFloat(s.weightKg)
                : s.weightKg;
            return setSum + weight * s.reps;
          }, 0),
        0,
      ),
    [workout.exercises],
  );

  const duration = workout.endedAt
    ? Math.round(
        (new Date(workout.endedAt).getTime() -
          new Date(workout.startedAt).getTime()) /
          1000 /
          60,
      )
    : null;

  const title = workout.name ?? "Empty Workout";

  return (
    <Card.Root
      variant={isActive ? "elevated" : "outline"}
      cursor="pointer"
      onClick={onClick}
      _hover={{ borderColor: "blue.500" }}
    >
      <Card.Header pb="2">
        <HStack justify="space-between">
          <Card.Title truncate>{title}</Card.Title>
          <HStack gap="1" flexShrink={0}>
            {isActive && (
              <Badge colorPalette="green" size="sm">
                Active
              </Badge>
            )}
            <WorkoutOptionsMenu workout={workout} onDeleted={onDeleted} />
          </HStack>
        </HStack>
        <Text textStyle="sm" color="fg.muted">
          {new Date(workout.startedAt).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
          {workout.place && ` • ${workout.place.name}`}
          {duration && ` • ${formatDuration(duration)}`}
        </Text>
      </Card.Header>
      <Card.Body pt="0">
        <HStack gap="4" textStyle="sm" color="fg.muted">
          <Text>{workout.exercises.length} exercises</Text>
          <Text>{totalSets} sets</Text>
          <Text>{Math.round(totalVolume).toLocaleString()} kg</Text>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
}
