"use client";

import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { StatCard } from "@/components/stat-card";
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { WorkoutCard } from "@/components/workout-card";
import {
  createWorkout,
  type Stats,
  useTemplates,
  type Workout,
} from "@/lib/hooks";

export function DashboardClient({
  userName,
  workouts,
  stats,
}: {
  userName: string | null;
  workouts: Workout[];
  stats: Stats;
}) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);

  const handleStartWorkout = async (templateId?: string) => {
    try {
      setIsStarting(true);
      const workout = await createWorkout({ templateId });
      window.location.href = `/workouts/${workout.id}`;
    } catch {
      setIsStarting(false);
    }
  };

  const activeWorkouts = useMemo(
    () => workouts.filter((w) => !w.endedAt),
    [workouts],
  );
  const completedWorkouts = useMemo(
    () => workouts.filter((w) => w.endedAt),
    [workouts],
  );

  return (
    <Stack gap="8">
      {/* Welcome Header */}
      <Flex
        justify="space-between"
        align={{ sm: "center" }}
        direction={{ base: "column", sm: "row" }}
        gap="4"
      >
        <Box>
          <Heading size="2xl" mb="2">
            Welcome back{userName ? `, ${userName}` : ""}
          </Heading>
          <Text color="fg.muted">
            Track your lifts, monitor progress, and crush your goals
          </Text>
        </Box>
        <Flex gap="3" direction={{ base: "column", sm: "row" }}>
          <Button variant="outline" onClick={() => setShowTemplateDialog(true)}>
            Start from Template
          </Button>
          <Button
            colorPalette="blue"
            onClick={() => handleStartWorkout()}
            disabled={isStarting}
          >
            {isStarting ? <Spinner size="sm" /> : "Start Workout"}
          </Button>
        </Flex>
      </Flex>

      {/* Quick Stats */}
      <SimpleGrid columns={{ base: 2, md: 4 }} gap="4">
        <StatCard
          label="Workouts (Month)"
          value={stats.totalWorkouts.toString()}
        />
        <StatCard
          label="Volume (Month)"
          value={`${stats.totalVolume.toLocaleString()} kg`}
        />
        <StatCard
          label="Week Streak"
          value={
            stats.streak > 0
              ? `${stats.streak} week${stats.streak > 1 ? "s" : ""}`
              : "—"
          }
        />
        <StatCard
          label="PRs (Month)"
          value={stats.prsInRange > 0 ? stats.prsInRange.toString() : "—"}
        />
      </SimpleGrid>

      {/* Active Workouts */}
      {activeWorkouts.length > 0 && (
        <Box>
          <Heading size="md" mb="4">
            Active Workout
          </Heading>
          <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap="4">
            {activeWorkouts.map((workout) => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                onClick={() => router.push(`/workouts/${workout.id}`)}
                onDeleted={() => router.refresh()}
                isActive
              />
            ))}
          </Grid>
        </Box>
      )}

      {/* Recent Workouts */}
      <Box>
        <Heading size="md" mb="4">
          Recent Workouts
        </Heading>
        {completedWorkouts.length === 0 ? (
          <Card.Root variant="subtle">
            <Card.Body>
              <Text color="fg.muted" textAlign="center" py="8">
                No completed workouts yet. Start your first workout!
              </Text>
            </Card.Body>
          </Card.Root>
        ) : (
          <Stack gap="4">
            <Grid
              templateColumns={{
                base: "1fr",
                md: "repeat(2, 1fr)",
                lg: "repeat(3, 1fr)",
              }}
              gap="4"
            >
              {completedWorkouts.slice(0, 5).map((workout) => (
                <WorkoutCard
                  key={workout.id}
                  workout={workout}
                  onClick={() => router.push(`/workouts/${workout.id}`)}
                  onDeleted={() => router.refresh()}
                />
              ))}
            </Grid>
            <Button
              variant="outline"
              asChild
              alignSelf={{ base: "stretch", sm: "center" }}
            >
              <Link href="/workouts">View All Workouts</Link>
            </Button>
          </Stack>
        )}
      </Box>

      <StartFromTemplateDialog
        open={showTemplateDialog}
        onClose={() => setShowTemplateDialog(false)}
        onSelect={handleStartWorkout}
      />
    </Stack>
  );
}

function StartFromTemplateDialog({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (templateId: string) => void;
}) {
  const { data: templates, isLoading } = useTemplates();

  const handleSelect = (templateId: string) => {
    onSelect(templateId);
    onClose();
  };

  return (
    <DialogRoot open={open} onOpenChange={(e) => !e.open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start from Template</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>
        <DialogBody pb="6">
          {isLoading ? (
            <Flex justify="center" py="4">
              <Spinner />
            </Flex>
          ) : templates?.length === 0 ? (
            <Stack gap="3" align="center" py="4">
              <Text color="fg.muted" textAlign="center">
                No templates yet
              </Text>
              <Button variant="outline" size="sm" asChild>
                <Link href="/templates">Go to Templates</Link>
              </Button>
            </Stack>
          ) : (
            <Stack gap="2">
              {templates?.map((template) => (
                <Button
                  key={template.id}
                  variant="ghost"
                  justifyContent="flex-start"
                  onClick={() => handleSelect(template.id)}
                >
                  <Box textAlign="left">
                    <Text fontWeight="medium">{template.name}</Text>
                    <Text textStyle="xs" color="fg.muted">
                      {template.items.length} exercises
                    </Text>
                  </Box>
                </Button>
              ))}
            </Stack>
          )}
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}
