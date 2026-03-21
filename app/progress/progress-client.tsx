"use client";

import { Chart, useChart } from "@chakra-ui/charts";
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatCard } from "@/components/stat-card";
import {
  type DateRange,
  type ExerciseUsed,
  type Stats,
  useExerciseStats,
  useStats,
} from "@/lib/hooks";
import { formatDateForInput } from "@/lib/utils";

type RangePreset = "week" | "month" | "3months" | "year" | "custom";

function getDateRangeFromPreset(preset: RangePreset): DateRange {
  const now = new Date();
  const endDate = new Date(now);
  let startDate: Date;

  switch (preset) {
    case "week":
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      break;
    case "month":
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
      break;
    case "3months":
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 3);
      break;
    case "year":
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
  }

  return { startDate, endDate };
}

export function ProgressClient({ initialStats }: { initialStats: Stats }) {
  const [rangePreset, setRangePreset] = useState<RangePreset>("month");
  const [customRange, setCustomRange] = useState<DateRange>(() =>
    getDateRangeFromPreset("month"),
  );

  const dateRange = useMemo(() => {
    if (rangePreset === "custom") {
      return customRange;
    }
    return getDateRangeFromPreset(rangePreset);
  }, [rangePreset, customRange]);

  const { data: stats, isLoading: statsLoading } = useStats(dateRange, {
    fallbackData: rangePreset === "month" ? initialStats : undefined,
  });
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    "total",
  );
  const [showAllExercises, setShowAllExercises] = useState(false);

  const exercisesUsed = stats?.exercisesUsed ?? [];

  const presetButtons: { label: string; value: RangePreset }[] = [
    { label: "Week", value: "week" },
    { label: "Month", value: "month" },
    { label: "3 Months", value: "3months" },
    { label: "Year", value: "year" },
    { label: "Custom", value: "custom" },
  ];

  return (
    <Stack gap="8">
      <Box>
        <Heading size="xl">Progress</Heading>
        <Text color="fg.muted">
          Track your strength gains and training consistency
        </Text>
      </Box>

      {/* Date Range Selector */}
      <Card.Root variant="subtle">
        <Card.Body>
          <Stack gap="4">
            <HStack gap="2" flexWrap="wrap">
              {presetButtons.map((btn) => (
                <Button
                  key={btn.value}
                  size="sm"
                  variant={rangePreset === btn.value ? "solid" : "outline"}
                  colorPalette={rangePreset === btn.value ? "blue" : undefined}
                  onClick={() => setRangePreset(btn.value)}
                >
                  {btn.label}
                </Button>
              ))}
            </HStack>

            {rangePreset === "custom" && (
              <HStack gap="4" flexWrap="wrap">
                <HStack gap="2">
                  <Text textStyle="sm" color="fg.muted">
                    From:
                  </Text>
                  <Input
                    type="date"
                    size="sm"
                    width="auto"
                    value={formatDateForInput(customRange.startDate)}
                    onChange={(e) =>
                      setCustomRange((prev) => ({
                        ...prev,
                        startDate: new Date(e.target.value),
                      }))
                    }
                  />
                </HStack>
                <HStack gap="2">
                  <Text textStyle="sm" color="fg.muted">
                    To:
                  </Text>
                  <Input
                    type="date"
                    size="sm"
                    width="auto"
                    value={formatDateForInput(customRange.endDate)}
                    onChange={(e) =>
                      setCustomRange((prev) => ({
                        ...prev,
                        endDate: new Date(e.target.value),
                      }))
                    }
                  />
                </HStack>
              </HStack>
            )}
          </Stack>
        </Card.Body>
      </Card.Root>

      {/* Overview Stats */}
      {statsLoading ? (
        <Flex justify="center" py="4">
          <Spinner />
        </Flex>
      ) : stats ? (
        <SimpleGrid columns={{ base: 2, md: 4 }} gap="4">
          <StatCard label="Workouts" value={stats.totalWorkouts.toString()} />
          <StatCard
            label="Total Volume"
            value={`${stats.totalVolume.toLocaleString()} kg`}
          />
          <StatCard label="Total Sets" value={stats.totalSets.toString()} />
          <StatCard
            label="PRs"
            value={stats.prsInRange > 0 ? stats.prsInRange.toString() : "—"}
          />
        </SimpleGrid>
      ) : null}

      {/* Strength Progress Chart */}
      <Box>
        <Heading size="md" mb="4">
          Strength Progress
        </Heading>

        {statsLoading ? (
          <Flex justify="center" py="8">
            <Spinner />
          </Flex>
        ) : (
          <Stack gap="4">
            <HStack gap="2" flexWrap="wrap">
              <Button
                size="sm"
                variant={selectedExerciseId === "total" ? "solid" : "outline"}
                colorPalette={
                  selectedExerciseId === "total" ? "blue" : undefined
                }
                onClick={() => setSelectedExerciseId("total")}
              >
                Total
              </Button>
              {(showAllExercises
                ? exercisesUsed
                : exercisesUsed.slice(0, 10)
              ).map((ue) => (
                <ExerciseButton
                  key={ue.id}
                  exercise={ue}
                  isSelected={selectedExerciseId === ue.id}
                  onClick={() => setSelectedExerciseId(ue.id)}
                />
              ))}
              {exercisesUsed.length > 10 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllExercises((prev) => !prev)}
                >
                  {showAllExercises
                    ? "Show less"
                    : `+${exercisesUsed.length - 10} more`}
                </Button>
              )}
            </HStack>

            {selectedExerciseId === "total" ? (
              stats?.avgE1rmHistory && stats.avgE1rmHistory.length > 0 ? (
                <Card.Root>
                  <Card.Header>
                    <Card.Title>Average Estimated 1RM Over Time</Card.Title>
                    <Text textStyle="sm" color="fg.muted">
                      Average of best estimated 1RM across all exercises per
                      workout day
                    </Text>
                  </Card.Header>
                  <Card.Body>
                    <AvgE1RMChart history={stats.avgE1rmHistory} />
                  </Card.Body>
                </Card.Root>
              ) : (
                <Card.Root variant="subtle">
                  <Card.Body>
                    <Text color="fg.muted" textAlign="center" py="8">
                      No workout data in the selected date range. Complete some
                      workouts to see your strength progress!
                    </Text>
                  </Card.Body>
                </Card.Root>
              )
            ) : selectedExerciseId ? (
              <ExerciseProgressChart exerciseId={selectedExerciseId} />
            ) : null}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}

function ExerciseButton({
  exercise,
  isSelected,
  onClick,
}: {
  exercise: ExerciseUsed;
  isSelected: boolean;
  onClick: () => void;
}) {
  const name = exercise.name || "Unknown";

  return (
    <Button
      size="sm"
      variant={isSelected ? "solid" : "outline"}
      colorPalette={isSelected ? "blue" : undefined}
      onClick={onClick}
    >
      {name}
    </Button>
  );
}

function AvgE1RMChart({
  history,
}: {
  history: { date: string; avgE1rm: number }[];
}) {
  const chartData = useMemo(
    () =>
      history.map((h) => ({
        avgE1rm: h.avgE1rm,
        date: new Date(h.date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
      })),
    [history],
  );

  const chart = useChart({
    data: chartData,
    series: [
      { name: "avgE1rm", color: "green.solid", label: "Avg Estimated 1RM" },
    ],
  });

  return (
    <Chart.Root maxH="sm" chart={chart}>
      <LineChart data={chart.data}>
        <CartesianGrid stroke={chart.color("border")} vertical={false} />
        <XAxis
          axisLine={false}
          dataKey={chart.key("date")}
          stroke={chart.color("border")}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tickMargin={10}
          stroke={chart.color("border")}
          domain={["dataMin - 5", "dataMax + 5"]}
          tickFormatter={(value) => `${Math.round(Number(value))} kg`}
        />
        <Tooltip
          animationDuration={100}
          cursor={false}
          content={<Chart.Tooltip />}
        />
        {chart.series.map((item) => (
          <Line
            key={item.name}
            isAnimationActive={false}
            dataKey={chart.key(item.name)}
            stroke={chart.color(item.color)}
            strokeWidth={2}
            dot={{ fill: chart.color(item.color), r: 4 }}
          />
        ))}
      </LineChart>
    </Chart.Root>
  );
}

function ExerciseProgressChart({ exerciseId }: { exerciseId: string }) {
  const { data, isLoading } = useExerciseStats(exerciseId);

  if (isLoading) {
    return (
      <Flex justify="center" py="8">
        <Spinner />
      </Flex>
    );
  }

  if (!data || data.history.length === 0) {
    return (
      <Card.Root variant="subtle">
        <Card.Body>
          <Text color="fg.muted" textAlign="center" py="8">
            No workout data yet for this exercise. Complete some workouts to see
            your progress!
          </Text>
        </Card.Body>
      </Card.Root>
    );
  }

  const exerciseName = data.exercise.name || "Exercise";

  return (
    <Card.Root>
      <Card.Header>
        <HStack justify="space-between" flexWrap="wrap" gap="2">
          <Box>
            <Card.Title>{exerciseName}</Card.Title>
            <Text textStyle="sm" color="fg.muted">
              Estimated 1RM over time
            </Text>
          </Box>
          {data.pr && (
            <Badge colorPalette="green" size="lg">
              PR: {data.pr.estimated1RM} kg
            </Badge>
          )}
        </HStack>
      </Card.Header>
      <Card.Body>
        <E1RMChart history={data.history} />

        {data.history.length > 0 && (
          <SimpleGrid columns={{ base: 2, md: 3 }} gap="4" mt="6">
            <Box>
              <Text textStyle="sm" color="fg.muted">
                Best Set (Last)
              </Text>
              <Text fontWeight="semibold">
                {data.history[data.history.length - 1].bestSet.weight} kg ×{" "}
                {data.history[data.history.length - 1].bestSet.reps} reps
              </Text>
            </Box>
            <Box>
              <Text textStyle="sm" color="fg.muted">
                Total Sessions
              </Text>
              <Text fontWeight="semibold">{data.history.length}</Text>
            </Box>
            <Box>
              <Text textStyle="sm" color="fg.muted">
                Latest Volume
              </Text>
              <Text fontWeight="semibold">
                {Math.round(
                  data.history[data.history.length - 1].totalVolume,
                ).toLocaleString()}{" "}
                kg
              </Text>
            </Box>
          </SimpleGrid>
        )}
      </Card.Body>
    </Card.Root>
  );
}

function E1RMChart({
  history,
}: {
  history: { date: string; estimated1RM: number }[];
}) {
  const chartData = useMemo(
    () =>
      history.map((h) => ({
        e1rm: Math.round(h.estimated1RM * 100) / 100,
        date: new Date(h.date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
      })),
    [history],
  );

  const chart = useChart({
    data: chartData,
    series: [{ name: "e1rm", color: "blue.solid", label: "Estimated 1RM" }],
  });

  return (
    <Chart.Root maxH="sm" chart={chart}>
      <LineChart data={chart.data}>
        <CartesianGrid stroke={chart.color("border")} vertical={false} />
        <XAxis
          axisLine={false}
          dataKey={chart.key("date")}
          stroke={chart.color("border")}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tickMargin={10}
          stroke={chart.color("border")}
          domain={["dataMin - 5", "dataMax + 5"]}
          tickFormatter={(value) =>
            `${Math.round(Number(value) * 100) / 100} kg`
          }
        />
        <Tooltip
          animationDuration={100}
          cursor={false}
          content={<Chart.Tooltip />}
        />
        {chart.series.map((item) => (
          <Line
            key={item.name}
            isAnimationActive={false}
            dataKey={chart.key(item.name)}
            stroke={chart.color(item.color)}
            strokeWidth={2}
            dot={{ fill: chart.color(item.color), r: 4 }}
          />
        ))}
      </LineChart>
    </Chart.Root>
  );
}
