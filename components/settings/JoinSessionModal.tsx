import { useSessionStore } from "@/store/sessionStore";
import { fetchSessionSnapshot } from "@/utils/sessionSync";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { TextInput as RNTextInput, View } from "react-native";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";

interface JoinSessionModalProps {
  visible: boolean;
  onDismiss: () => void;
}

type Step = "code" | "scan" | "name";

export default function JoinSessionModal({
  visible,
  onDismiss,
}: JoinSessionModalProps) {
  const theme = useTheme();
  const router = useRouter();
  const { guestName: savedGuestName, joinSession } = useSessionStore();
  const [permission, requestPermission] = useCameraPermissions();

  const [step, setStep] = useState<Step>("scan");
  const [codeInput, setCodeInput] = useState("");
  const [resolvedCode, setResolvedCode] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (visible) {
      setCodeInput("");
      setResolvedCode(null);
      setNameInput(savedGuestName ?? "");
      setError(null);
    }
  }, [visible, savedGuestName]);

  // Open straight into the QR scanner; falls back to code entry if camera
  // permission is denied.
  useEffect(() => {
    if (visible) {
      setStep("scan");
      handleScanQr();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const validateCode = async (code: string) => {
    setChecking(true);
    setError(null);
    const snapshot = await fetchSessionSnapshot(code);
    setChecking(false);
    if (!snapshot) {
      setError("Session not found. Check the code and try again.");
      return;
    }
    setResolvedCode(code);
    setStep("name");
  };

  const handleScanQr = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError("Camera access is needed to scan a QR code.");
        setStep("code");
        return;
      }
    }
    setError(null);
    setStep("scan");
  };

  const handleBarcodeScanned = (result: { data: string }) => {
    if (step !== "scan") return;
    setStep("code");
    validateCode(result.data.trim().toUpperCase());
  };

  const handleJoin = async () => {
    if (!resolvedCode || !nameInput.trim()) return;
    setJoining(true);
    const success = await joinSession(resolvedCode, nameInput.trim());
    setJoining(false);
    if (!success) {
      setError("That session is no longer available.");
      setStep("code");
      return;
    }
    onDismiss();
    router.push("/(tabs)/stack");
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        testID="join-session-dialog"
      >
        <Dialog.Title>Join a Session</Dialog.Title>
        <Dialog.Content>
          {step === "code" && (
            <View style={{ gap: 12 }}>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Enter the session code from the host, or scan their QR code.
              </Text>
              <RNTextInput
                value={codeInput}
                onChangeText={(v) => setCodeInput(v.toUpperCase())}
                placeholder="ABC123"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                autoCapitalize="characters"
                maxLength={6}
                testID="join-session-code-input"
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.outlineVariant,
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 20,
                  letterSpacing: 4,
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
          )}

          {step === "scan" && (
            <View style={{ gap: 12 }}>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Point your camera at the host&apos;s QR code.
              </Text>
              <View
                style={{
                  height: 280,
                  borderRadius: 12,
                  overflow: "hidden",
                  backgroundColor: "#000",
                }}
              >
                {permission?.granted && (
                  <CameraView
                    style={{ flex: 1 }}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    onBarcodeScanned={handleBarcodeScanned}
                  />
                )}
              </View>
            </View>
          )}

          {step === "name" && (
            <View style={{ gap: 12 }}>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                What name should the host see for you?
              </Text>
              <RNTextInput
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Your name"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                testID="join-session-name-input"
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.outlineVariant,
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 16,
                  color: theme.colors.onSurface,
                }}
              />
              {error && (
                <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                  {error}
                </Text>
              )}
            </View>
          )}
        </Dialog.Content>
        {/* Dialog.Actions clones its direct children with a `compact` prop, so
            buttons must be passed as keyed arrays — never wrapped in a Fragment. */}
        <Dialog.Actions>
          {step === "code" && [
            <Button
              key="cancel"
              onPress={onDismiss}
              testID="join-session-cancel"
            >
              Cancel
            </Button>,
            <Button
              key="scan"
              onPress={handleScanQr}
              testID="join-session-scan"
            >
              Scan QR
            </Button>,
            <Button
              key="next"
              mode="contained"
              loading={checking}
              disabled={codeInput.trim().length < 4 || checking}
              onPress={() => validateCode(codeInput.trim())}
              testID="join-session-submit-code"
            >
              Next
            </Button>,
          ]}
          {step === "scan" && [
            <Button
              key="cancel"
              onPress={onDismiss}
              testID="join-session-cancel-scan"
            >
              Cancel
            </Button>,
            <Button
              key="enter-code"
              onPress={() => {
                setError(null);
                setStep("code");
              }}
              testID="join-session-enter-code"
            >
              Enter Code
            </Button>,
          ]}
          {step === "name" && [
            <Button
              key="back"
              onPress={() => setStep("code")}
              testID="join-session-back"
            >
              Back
            </Button>,
            <Button
              key="join"
              mode="contained"
              loading={joining}
              disabled={!nameInput.trim() || joining}
              onPress={handleJoin}
              testID="join-session-submit-name"
            >
              Join
            </Button>,
          ]}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
