import React from "react";
import { useWindowDimensions } from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onDismiss: () => void;
  confirmLabel?: string;
  destructive?: boolean;
}

export default function ConfirmDialog({
  visible,
  title,
  message,
  onConfirm,
  onDismiss,
  confirmLabel = "Confirm",
  destructive = true,
}: ConfirmDialogProps) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={isLandscape ? { alignSelf: "center", width: "50%" } : undefined}
      >
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium">{message}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button
            onPress={onConfirm}
            textColor={destructive ? "#BA1A1A" : undefined}
          >
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
