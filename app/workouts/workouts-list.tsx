"use client";

import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  HStack,
  Input,
  NativeSelect,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { WorkoutCard } from "@/components/workout-card";
import { type Place, useDebouncedValue, type Workout } from "@/lib/hooks";

type StatusFilter = "all" | "active" | "completed";
type SortOrder = "newest" | "oldest";

export function WorkoutsList({
  workouts,
  places,
}: {
  workouts: Workout[];
  places: Place[];
}) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [placeFilter, setPlaceFilter] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const filtered = useMemo(() => {
    let list: Workout[] = workouts;

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((w) => {
        const name = w.name ?? "";
        return name.toLowerCase().includes(q);
      });
    }

    if (statusFilter === "active") {
      list = list.filter((w) => !w.endedAt);
    } else if (statusFilter === "completed") {
      list = list.filter((w) => w.endedAt);
    }

    if (placeFilter) {
      list = list.filter((w) => w.place?.id === placeFilter);
    }

    if (sortOrder === "oldest") {
      list = [...list].reverse();
    }

    return list;
  }, [workouts, debouncedSearch, statusFilter, placeFilter, sortOrder]);

  const usedPlaces = places.filter((p) => !p.isArchived);

  return (
    <Stack gap="6">
      <Box>
        <Heading size="xl">Workouts</Heading>
        <Text color="fg.muted">Browse and filter your workout history</Text>
      </Box>

      <Flex gap="3" wrap="wrap" align="end">
        <Box flex="1" minW="200px">
          <Input
            placeholder="Search workouts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Box>

        <HStack gap="1">
          {(["all", "active", "completed"] as const).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={statusFilter === status ? "solid" : "outline"}
              onClick={() => setStatusFilter(status)}
              textTransform="capitalize"
            >
              {status}
            </Button>
          ))}
        </HStack>

        {usedPlaces.length > 0 && (
          <NativeSelect.Root size="sm" width="auto" minW="140px">
            <NativeSelect.Field
              value={placeFilter}
              onChange={(e) => setPlaceFilter(e.target.value)}
            >
              <option value="">All places</option>
              {usedPlaces.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            setSortOrder((o) => (o === "newest" ? "oldest" : "newest"))
          }
        >
          {sortOrder === "newest" ? "Newest first" : "Oldest first"}
        </Button>
      </Flex>

      {filtered.length === 0 ? (
        <Card.Root variant="subtle">
          <Card.Body>
            <Text color="fg.muted" textAlign="center" py="8">
              {workouts.length === 0
                ? "No workouts yet. Start your first workout from the home page!"
                : "No workouts match your filters."}
            </Text>
          </Card.Body>
        </Card.Root>
      ) : (
        <Stack gap="2">
          <Text textStyle="sm" color="fg.muted">
            {filtered.length} workout{filtered.length !== 1 ? "s" : ""}
          </Text>
          <Grid
            templateColumns={{
              base: "1fr",
              md: "repeat(2, 1fr)",
              lg: "repeat(3, 1fr)",
            }}
            gap="4"
          >
            {filtered.map((workout) => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                onClick={() => router.push(`/workouts/${workout.id}`)}
                onDeleted={() => router.refresh()}
                isActive={!workout.endedAt}
              />
            ))}
          </Grid>
        </Stack>
      )}
    </Stack>
  );
}
