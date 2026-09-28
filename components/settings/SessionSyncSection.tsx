import AlertDialog from "@/components/common/AlertDialog";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import JoinSessionModal from "@/components/settings/JoinSessionModal";
import { useIsSmallDevice } from "@/hooks/useResponsiveColumns";
import { useSessionStore } from "@/store/sessionStore";
import * as Clipboard from "expo-clipboard";
import React, { useState } from "react";
import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import {
  Card,
  Divider,
  IconButton,
  List,
  Text,
  useTheme,
} from "react-native-paper";

export default function SessionSyncSection() {
  const theme = useTheme();
  const isSmallDevice = useIsSmallDevice();
  const { role, sessionId, guestsPresent, startHosting, stopHosting } =
    useSessionStore();
  const [joinVisible, setJoinVisible] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [startError, setStartError] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleStartHosting = async () => {
    try {
      await startHosting();
    } catch {
      setStartError(true);
    }
  };

  const handleCopyCode = async () => {
    if (!sessionId) return;
    await Clipboard.setStringAsync(sessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <Text
        variant="labelLarge"
        style={{
          color: theme.colors.primary,
          paddingHorizontal: 4,
          paddingTop: 8,
          paddingBottom: 4,
          textTransform: "uppercase",
          letterSpacing: 0.8,
        }}
      >
        Live Sync
      </Text>

      <Card mode="elevated">
        {role === "host" ? (
          <View style={{ padding: 20, alignItems: "center", gap: 12 }}>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Guests can scan this code or enter it manually
            </Text>
            <View
              style={{
                padding: 12,
                backgroundColor: "#FFFFFF",
                borderRadius: 12,
              }}
            >
              <QRCode value={sessionId ?? ""} size={160} />
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Text
                variant="headlineSmall"
                style={{
                  fontWeight: "700",
                  letterSpacing: 4,
                  color: theme.colors.onSurface,
                }}
                testID="session-sync-code"
              >
                {sessionId}
              </Text>
              <IconButton
                icon={copied ? "check" : "content-copy"}
                size={18}
                onPress={handleCopyCode}
                testID="session-sync-copy-code"
              />
            </View>

            <Divider style={{ width: "100%", marginVertical: 8 }} />

            <View style={{ width: "100%", gap: 4 }}>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {`${guestsPresent.length} watching`}
              </Text>
              {guestsPresent.map((g) => (
                <View
                  key={g.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingVertical: 4,
                  }}
                >
                  <List.Icon
                    icon="account-circle-outline"
                    color={theme.colors.primary}
                  />
                  <Text variant="bodyMedium">{g.name}</Text>
                </View>
              ))}
            </View>

            <List.Item
              style={{ width: "100%" }}
              title="Stop Hosting"
              titleStyle={{ color: theme.colors.error }}
              left={(props) => (
                <List.Icon {...props} icon="stop-circle-outline" color={theme.colors.error} />
              )}
              onPress={() => setConfirmStop(true)}
              testID="session-sync-stop-hosting"
            />
          </View>
        ) : (
          <View style={{ flexDirection: isSmallDevice ? "column" : "row" }}>
            <List.Item
              style={{ flex: 1 }}
              title="Host a Session"
              description="Let others view this game live"
              left={(props) => (
                <List.Icon {...props} icon="access-point" color={theme.colors.primary} />
              )}
              onPress={handleStartHosting}
              testID="session-sync-host"
            />
            {isSmallDevice ? (
              <Divider />
            ) : (
              <View
                style={{
                  width: 1,
                  backgroundColor: theme.colors.outlineVariant,
                  marginVertical: 8,
                }}
              />
            )}
            <List.Item
              style={{ flex: 1 }}
              title="Join a Session"
              description="View someone else's game"
              left={(props) => (
                <List.Icon {...props} icon="qrcode-scan" color={theme.colors.primary} />
              )}
              onPress={() => setJoinVisible(true)}
              testID="session-sync-join"
            />
          </View>
        )}
      </Card>

      <JoinSessionModal
        visible={joinVisible}
        onDismiss={() => setJoinVisible(false)}
      />

      <ConfirmDialog
        visible={confirmStop}
        title="Stop Hosting"
        message="End this session? Guests currently watching will be disconnected."
        confirmLabel="Stop"
        onConfirm={() => {
          setConfirmStop(false);
          stopHosting();
        }}
        onDismiss={() => setConfirmStop(false)}
      />

      <AlertDialog
        visible={startError}
        title="Couldn't Start Session"
        message="Something went wrong starting the session. Check your connection and try again."
        onDismiss={() => setStartError(false)}
      />
    </>
  );
}
