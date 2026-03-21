"use client";

import { CloseButton, Dialog, Portal } from "@chakra-ui/react";
import * as React from "react";

interface DialogContentProps extends Dialog.ContentProps {
  portalled?: boolean;
  portalRef?: React.RefObject<HTMLElement | null>;
  backdrop?: boolean;
}

export const DialogContent = React.forwardRef<
  HTMLDivElement,
  DialogContentProps
>(function DialogContent(props, ref) {
  const {
    children,
    portalled = true,
    portalRef,
    backdrop = true,
    ...rest
  } = props;

  return (
    <Portal disabled={!portalled} container={portalRef}>
      {backdrop && <Dialog.Backdrop />}
      <Dialog.Positioner>
        <Dialog.Content ref={ref} {...rest} asChild={false}>
          {children}
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  );
});

export const DialogCloseTrigger = React.forwardRef<
  HTMLButtonElement,
  Dialog.CloseTriggerProps
>(function DialogCloseTrigger(props, ref) {
  return (
    <Dialog.CloseTrigger
      position="absolute"
      top="2"
      insetEnd="2"
      {...props}
      asChild
    >
      <CloseButton size="sm" ref={ref}>
        {props.children}
      </CloseButton>
    </Dialog.CloseTrigger>
  );
});

export const DialogRoot = Dialog.Root;
export const DialogFooter = Dialog.Footer;
export const DialogHeader = Dialog.Header;
export const DialogBody = Dialog.Body;
export const DialogBackdrop = Dialog.Backdrop;
export const DialogTitle = Dialog.Title;
export const DialogDescription = Dialog.Description;
export const DialogTrigger = Dialog.Trigger;
export const DialogActionTrigger = Dialog.ActionTrigger;
