import { useSessionStore } from "@/store/sessionStore";
import React from "react";
import { useWindowDimensions } from "react-native";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";

/**
 * Host side of Switch Host: shows the 4-digit code the chosen guest has to
 * type on their own device. Stays up until they enter it (this device then
 * steps down and the dialog closes), decline, or the host cancels.
 */
export default function HostTransferCodeDialog() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { pendingTransfer, cancelHostTransfer } = useSessionStore();

  return (
    <Portal>
      <Dialog
        visible={!!pendingTransfer}
        dismissable={false}
        style={isLandscape ? { alignSelf: "center", width: "50%" } : undefined}
        testID="host-transfer-code-dialog"
      >
        <Dialog.Title>Switch Host</Dialog.Title>
        <Dialog.Content style={{ alignItems: "center", gap: 12 }}>
          <Text variant="bodyMedium" style={{ textAlign: "center" }}>
            {`Ask ${pendingTransfer?.guestName} to enter this code on their device.`}
          </Text>
          <Text
            variant="displaySmall"
            style={{
              fontWeight: "700",
              letterSpacing: 12,
              color: theme.colors.primary,
            }}
            testID="host-transfer-code"
          >
            {pendingTransfer?.code}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}
          >
            Once they do, they become the host and this device switches to
            watching. The code expires in 5 minutes.
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button
            onPress={cancelHostTransfer}
            testID="host-transfer-code-cancel"
          >
            Cancel
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
