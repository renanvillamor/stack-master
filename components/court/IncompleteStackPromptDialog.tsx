import { Court, Stack } from "@/types";
import React from "react";
import { useWindowDimensions, View } from "react-native";
import { Button, Dialog, Icon, Portal, Text, useTheme } from "react-native-paper";

interface IncompleteStackPromptDialogProps {
  court: Court | null;
  stack: Stack | null;
  stackNumber: number;
  onCompleteStack: () => void;
  onMoveAvailableInstead: () => void;
  onDismiss: () => void;
}

export default function IncompleteStackPromptDialog({
  court,
  stack,
  stackNumber,
  onCompleteStack,
  onMoveAvailableInstead,
  onDismiss,
}: IncompleteStackPromptDialogProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const filledCount = stack
    ? stack.team1.playerIds.length + stack.team2.playerIds.length
    : 0;

  return (
    <Portal>
      <Dialog
        visible={!!court && !!stack}
        onDismiss={onDismiss}
        style={isLandscape ? { alignSelf: "center", width: "50%" } : undefined}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 4,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: theme.colors.surfaceVariant,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon
              source="alert-circle-outline"
              size={22}
              color={theme.colors.onSurfaceVariant}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" style={{ fontWeight: "700" }}>
              Next Stack Incomplete
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Stack #{stackNumber} only has {filledCount}/4 players.
            </Text>
          </View>
        </View>

        <Dialog.Content style={{ paddingTop: 16 }}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
            Do you want to fill Stack #{stackNumber} before moving it to{" "}
            <Text style={{ fontWeight: "700" }}>{court?.name}</Text>, or move the
            next available/complete stack instead?
          </Text>
        </Dialog.Content>

        <Dialog.Actions>
          <View style={{ flexDirection: "column", gap: 8, flex: 1 }}>
            <Button
              mode="contained"
              onPress={onMoveAvailableInstead}
              icon="map-marker-plus-outline"
            >
              Move Next Available Stack
            </Button>
            <Button
              mode="outlined"
              onPress={onCompleteStack}
              icon="account-plus-outline"
            >
              Complete This Stack
            </Button>
          </View>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
