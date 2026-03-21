import { Card, Text } from "@chakra-ui/react";

export function StatCard({
  label,
  value,
  valueTextStyle = "2xl",
}: {
  label: string;
  value: string;
  valueTextStyle?: string;
}) {
  return (
    <Card.Root variant="subtle">
      <Card.Body py="3">
        <Text textStyle="sm" color="fg.muted">
          {label}
        </Text>
        <Text textStyle={valueTextStyle} fontWeight="bold">
          {value}
        </Text>
      </Card.Body>
    </Card.Root>
  );
}
