import React from "react";
import { useWindowDimensions } from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";

interface AlertDialogProps {
  visible: boolean;
  title: string;
  message: string;
  onDismiss: () => void;
  dismissLabel?: string;
}

/** Single-button dialog for surfacing a blocking error or notice. */
export default function AlertDialog({
  visible,
  title,
  message,
  onDismiss,
  dismissLabel = "OK",
}: AlertDialogProps) {
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
          <Button testID="alert-dialog-ok" onPress={onDismiss}>
            {dismissLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
