import { Box, Container } from "@chakra-ui/react";
import { Nav } from "./nav";

interface ShellProps {
  children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  return (
    <Box minH="100vh" bg="bg">
      <Nav />
      <Container as="main" maxW="6xl" py="6">
        {children}
      </Container>
    </Box>
  );
}
