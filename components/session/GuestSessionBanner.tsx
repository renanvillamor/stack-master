import AlertDialog from "@/components/common/AlertDialog";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { useSessionStore } from "@/store/sessionStore";
import React, { useState } from "react";
import { View } from "react-native";
import { Icon, Text, TouchableRipple, useTheme } from "react-native-paper";

/**
 * The guest's only exit from a joined session — Player/Settings tabs are
 * hidden while watching, so "Leave" has to live here instead.
 */
export default function GuestSessionBanner() {
  const theme = useTheme();
  const { sessionId, guestName, sessionEnded, leaveSession } =
    useSessionStore();
  const [confirmLeave, setConfirmLeave] = useState(false);

  return (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 8,
          gap: 8,
          backgroundColor: theme.colors.primaryContainer,
        }}
      >
        <Icon source="access-point" size={16} color={theme.colors.primary} />
        <Text
          variant="labelMedium"
          numberOfLines={1}
          style={{ color: theme.colors.onPrimaryContainer, flex: 1 }}
        >
          {`Watching session ${sessionId} as ${guestName}`}
        </Text>
        <TouchableRipple
          onPress={() => setConfirmLeave(true)}
          borderless
          style={{ borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}
          testID="guest-banner-leave"
        >
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.error, fontWeight: "700" }}
          >
            Leave
          </Text>
        </TouchableRipple>
      </View>

      <ConfirmDialog
        visible={confirmLeave}
        title="Leave Session"
        message="Stop watching this game session?"
        confirmLabel="Leave"
        onConfirm={() => {
          setConfirmLeave(false);
          leaveSession();
        }}
        onDismiss={() => setConfirmLeave(false)}
      />

      <AlertDialog
        visible={sessionEnded}
        title="Session Ended"
        message="The host ended this session."
        onDismiss={leaveSession}
      />
    </>
  );
}
