import { useSessionStore } from "@/store/sessionStore";
import React, { useEffect, useState } from "react";
import { TextInput as RNTextInput, useWindowDimensions, View } from "react-native";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";

/**
 * Guest side of Switch Host: opens when the host offers this device the
 * session, and takes over once the guest types the code from the host's screen.
 */
export default function HostTransferClaimDialog() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { transferOffered, claimHost, declineHostTransfer } =
    useSessionStore();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Set once the offer can't be completed any more (too many tries, expired),
  // leaving only a Close button.
  const [dead, setDead] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (transferOffered) {
      setCode("");
      setError(null);
      setDead(false);
    }
  }, [transferOffered]);

  const handleConfirm = async () => {
    setClaiming(true);
    setError(null);
    const result = await claimHost(code);
    setClaiming(false);
    if (result === "ok") return;
    if (result === "wrong_code") {
      setCode("");
      setError("Incorrect code. Check the host's screen and try again.");
    } else if (result === "locked") {
      setDead(true);
      setError("Too many incorrect tries. Ask the host to start again.");
    } else if (result === "expired") {
      setDead(true);
      setError("This code has expired. Ask the host to start again.");
    } else {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
  };

  return (
    <Portal>
      <Dialog
        visible={transferOffered}
        dismissable={false}
        style={isLandscape ? { alignSelf: "center", width: "50%" } : undefined}
        testID="host-transfer-claim-dialog"
      >
        <Dialog.Title>Become Host</Dialog.Title>
        <Dialog.Content>
          <View style={{ gap: 12 }}>
            <Text variant="bodyMedium">
              The host wants to hand this session over to you. Enter the
              4-digit code shown on their screen.
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.error }}>
              The players, courts and stacks saved on this device will be
              replaced with this session&apos;s.
            </Text>
            <RNTextInput
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, ""))}
              placeholder="0000"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              keyboardType="number-pad"
              maxLength={4}
              editable={!dead && !claiming}
              autoFocus
              testID="host-transfer-claim-input"
              style={{
                borderWidth: 1,
                borderColor: theme.colors.outlineVariant,
                borderRadius: 10,
                padding: 12,
                fontSize: 24,
                letterSpacing: 8,
                textAlign: "center",
                color: theme.colors.onSurface,
              }}
            />
            {error && (
              <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                {error}
              </Text>
            )}
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          {dead ? (
            <Button
              onPress={declineHostTransfer}
              testID="host-transfer-claim-close"
            >
              Close
            </Button>
          ) : (
            [
              <Button
                key="decline"
                onPress={declineHostTransfer}
                disabled={claiming}
                testID="host-transfer-claim-decline"
              >
                Decline
              </Button>,
              <Button
                key="confirm"
                mode="contained"
                loading={claiming}
                disabled={code.length !== 4 || claiming}
                onPress={handleConfirm}
                testID="host-transfer-claim-confirm"
              >
                Become Host
              </Button>,
            ]
          )}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
