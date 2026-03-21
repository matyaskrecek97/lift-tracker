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
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { TemplateOptionsMenu } from "@/components/template-options-menu";
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createTemplate,
  type Exercise,
  seedExampleTemplates,
  useExercises,
  type WorkoutTemplate,
} from "@/lib/hooks";

export function TemplatesClient({
  templates,
}: {
  templates: WorkoutTemplate[];
}) {
  const router = useRouter();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedExamples = async () => {
    setIsSeeding(true);
    try {
      await seedExampleTemplates();
      router.refresh();
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <Stack gap="6">
      <Flex
        justify="space-between"
        align={{ sm: "center" }}
        direction={{ base: "column", sm: "row" }}
        gap="4"
      >
        <Box>
          <Heading size="xl">Templates</Heading>
          <Text color="fg.muted">
            Save your favorite workout routines for quick starts
          </Text>
        </Box>
        <Button colorPalette="blue" onClick={() => setShowCreateDialog(true)}>
          Create Template
        </Button>
      </Flex>

      {templates.length === 0 ? (
        <Card.Root variant="subtle">
          <Card.Body>
            <Stack gap="4" align="center" py="8">
              <Text color="fg.muted" textAlign="center">
                No templates yet. Create one to quickly start your favorite
                workouts!
              </Text>
              <Button
                variant="outline"
                onClick={handleSeedExamples}
                disabled={isSeeding}
              >
                {isSeeding ? (
                  <Spinner size="sm" />
                ) : (
                  "Add Example Templates (Legs / Push / Pull)"
                )}
              </Button>
            </Stack>
          </Card.Body>
        </Card.Root>
      ) : (
        <Grid
          templateColumns={{
            base: "1fr",
            md: "repeat(2, 1fr)",
            lg: "repeat(3, 1fr)",
          }}
          gap="4"
        >
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </Grid>
      )}

      <CreateTemplateDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />
    </Stack>
  );
}

function TemplateCard({ template }: { template: WorkoutTemplate }) {
  const router = useRouter();

  return (
    <Card.Root
      variant="outline"
      cursor="pointer"
      _hover={{ borderColor: "border.emphasized" }}
      onClick={() => router.push(`/templates/${template.id}`)}
      h="full"
      display="flex"
      flexDirection="column"
    >
      <Card.Header pb="2">
        <HStack justify="space-between">
          <Card.Title>{template.name}</Card.Title>
          <TemplateOptionsMenu
            template={template}
            onDeleted={() => router.refresh()}
          />
        </HStack>
      </Card.Header>
      <Card.Body pt="0" flex="1" display="flex" flexDirection="column">
        {template.items.length === 0 ? (
          <Text textStyle="sm" color="fg.muted">
            No exercises
          </Text>
        ) : (
          <Stack gap="1">
            {template.items.slice(0, 5).map((item) => (
              <Text key={item.id} textStyle="sm" color="fg.muted">
                {item.exercise.name}
              </Text>
            ))}
            {template.items.length > 5 && (
              <Text textStyle="sm" color="fg.muted">
                +{template.items.length - 5} more
              </Text>
            )}
          </Stack>
        )}
      </Card.Body>
    </Card.Root>
  );
}

function CreateTemplateDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { data: exercises } = useExercises();
  const [name, setName] = useState("");
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState("");

  const filteredExercises = useMemo(
    () =>
      exercises?.filter((e) =>
        e.name.toLowerCase().includes(search.toLowerCase()),
      ) || [],
    [exercises, search],
  );

  const toggleExercise = (id: string) => {
    setSelectedExercises((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id],
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      setIsCreating(true);
      await createTemplate({
        name: name.trim(),
        items: selectedExercises.map((id, index) => ({
          exerciseId: id,
          order: index,
        })),
      });
      setName("");
      setSelectedExercises([]);
      setSearch("");
      onClose();
      router.refresh();
    } catch {
      // apiFetch already throws with a message
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setName("");
    setSelectedExercises([]);
    setSearch("");
    onClose();
  };

  return (
    <DialogRoot open={open} onOpenChange={(e) => !e.open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Template</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>
        <DialogBody>
          <Stack gap="4">
            <Box>
              <Text fontWeight="medium" mb="2">
                Template Name
              </Text>
              <Input
                placeholder="e.g., Push Day, Full Body A"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Box>
            <Box>
              <Text fontWeight="medium" mb="2">
                Exercises ({selectedExercises.length} selected)
              </Text>
              <Input
                placeholder="Search exercises..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                mb="2"
              />
              <Stack gap="1" maxH="200px" overflowY="auto">
                {filteredExercises.map((exercise) => (
                  <ExerciseOption
                    key={exercise.id}
                    exercise={exercise}
                    isSelected={selectedExercises.includes(exercise.id)}
                    onToggle={() => toggleExercise(exercise.id)}
                  />
                ))}
                {filteredExercises.length === 0 && (
                  <Text
                    textStyle="sm"
                    color="fg.muted"
                    textAlign="center"
                    py="4"
                  >
                    {search
                      ? "No exercises match your search"
                      : "No exercises available"}
                  </Text>
                )}
              </Stack>
            </Box>
          </Stack>
        </DialogBody>
        <DialogFooter>
          <DialogActionTrigger asChild>
            <Button variant="outline">Cancel</Button>
          </DialogActionTrigger>
          <Button
            colorPalette="blue"
            onClick={handleCreate}
            disabled={isCreating || !name.trim()}
          >
            {isCreating ? <Spinner size="sm" /> : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}

function ExerciseOption({
  exercise,
  isSelected,
  onToggle,
}: {
  exercise: Exercise;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant={isSelected ? "subtle" : "ghost"}
      justifyContent="flex-start"
      size="sm"
      colorPalette={isSelected ? "blue" : undefined}
      onClick={onToggle}
    >
      <HStack w="full" justify="space-between">
        <Text>{exercise.name}</Text>
        {isSelected && <Text>✓</Text>}
      </HStack>
    </Button>
  );
}
