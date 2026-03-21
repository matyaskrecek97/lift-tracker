"use client";

import {
  Avatar,
  Box,
  Button,
  Container,
  Flex,
  Heading,
  HStack,
  IconButton,
  Menu,
  Portal,
  Spinner,
  Text,
} from "@chakra-ui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ColorModeButton } from "@/components/ui/color-mode";
import { signIn, signOut, useSession } from "@/lib/auth-client";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/workouts", label: "Workouts" },
  // { href: "/exercises", label: "Exercises" },
  // { href: "/places", label: "Places" },
  { href: "/templates", label: "Templates" },
  { href: "/progress", label: "Progress" },
];

function UserMenu() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <Spinner size="sm" />;
  }

  if (!session) {
    return (
      <Button
        size="sm"
        variant="solid"
        colorPalette="blue"
        onClick={() => signIn.social({ provider: "google" })}
      >
        Sign in
      </Button>
    );
  }

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button variant="ghost" size="sm" px="1">
          <HStack gap="2">
            <Avatar.Root size="sm">
              <Avatar.Image src={session.user.image ?? undefined} />
              <Avatar.Fallback>
                {session.user.name?.charAt(0) ?? "U"}
              </Avatar.Fallback>
            </Avatar.Root>
            <Text display={{ base: "none", md: "block" }} fontWeight="medium">
              {session.user.name}
            </Text>
          </HStack>
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item value="email" disabled>
              <Text textStyle="sm" color="fg.muted">
                {session.user.email}
              </Text>
            </Menu.Item>
            <Menu.Separator />
            <Menu.Item value="signout" onClick={() => signOut()}>
              Sign out
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

function MobileMenu() {
  const pathname = usePathname();

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton
          variant="ghost"
          size="sm"
          display={{ base: "flex", md: "none" }}
          aria-label="Open menu"
          focusRing="none"
          css={{ WebkitTapHighlightColor: "transparent" }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="160px">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Menu.Item key={link.href} value={link.href} asChild>
                  <Link href={link.href}>
                    <Text
                      fontWeight={isActive ? "semibold" : "normal"}
                      color={isActive ? "blue.500" : undefined}
                    >
                      {link.label}
                    </Text>
                  </Link>
                </Menu.Item>
              );
            })}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const navDisabled = isPending || !session;

  return (
    <Box
      as="nav"
      borderBottomWidth="1px"
      borderColor="border.muted"
      bg="bg.panel"
    >
      <Container maxW="6xl" py="3">
        <Flex justify="space-between" align="center">
          <HStack gap="2">
            {!navDisabled && <MobileMenu />}
            <Heading size="lg" fontWeight="bold">
              <Link href="/">Lift Tracker</Link>
            </Heading>
          </HStack>
          <HStack gap="4">
            <HStack gap="1" display={{ base: "none", md: "flex" }}>
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Box
                    key={link.href}
                    asChild
                    px="3"
                    py="1"
                    rounded="md"
                    bg={isActive ? "bg.muted" : "transparent"}
                    color={isActive ? "fg" : "fg.muted"}
                    fontWeight={isActive ? "medium" : "normal"}
                    _hover={{
                      bg: navDisabled ? undefined : "bg.muted",
                      color: navDisabled ? undefined : "fg",
                    }}
                    transition="backgrounds"
                    pointerEvents={navDisabled ? "none" : undefined}
                    opacity={navDisabled ? 0.5 : 1}
                  >
                    <Link href={link.href}>{link.label}</Link>
                  </Box>
                );
              })}
            </HStack>
            <ColorModeButton />
            <UserMenu />
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
}
