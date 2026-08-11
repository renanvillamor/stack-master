import { Court, PlayerRating, Stack } from "@/types";
import React from "react";
import { useWindowDimensions, View } from "react-native";
import { Button, Dialog, Icon, Portal, Text, useTheme } from "react-native-paper";

interface PlayerInfo {
  name: string;
  rating: PlayerRating;
}

interface NextStackPromptDialogProps {
  court: Court | null;
  stack: Stack | null;
  stackNumber: number;
  getPlayerInfo: (id: string) => PlayerInfo;
  onConfirm: () => void;
  onDismiss: () => void;
}

const TEAM1_COLOR = "#DC2626";
const TEAM2_COLOR = "#1D4ED8";

function formatRating(rating: PlayerRating): string {
  return rating === "NR" ? "NR" : rating.toFixed(1);
}

function PlayerRow({
  player,
  accentColor,
}: {
  player: PlayerInfo;
  accentColor: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: accentColor + "28",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon source="account" size={18} color={accentColor} />
      </View>
      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSurface, flex: 1 }}
        numberOfLines={1}
      >
        {player.name}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
        <Icon source="medal-outline" size={11} color={theme.colors.onSurfaceVariant} />
        <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 11, fontWeight: "700" }}>
          {formatRating(player.rating)}
        </Text>
      </View>
    </View>
  );
}

export default function NextStackPromptDialog({
  court,
  stack,
  stackNumber,
  getPlayerInfo,
  onConfirm,
  onDismiss,
}: NextStackPromptDialogProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const team1Players = stack?.team1.playerIds.map(getPlayerInfo) ?? [];
  const team2Players = stack?.team2.playerIds.map(getPlayerInfo) ?? [];

  return (
    <Portal>
      <Dialog
        visible={!!court && !!stack}
        onDismiss={onDismiss}
        style={isLandscape ? { alignSelf: "center", width: "50%" } : undefined}
      >
        {/* Header */}
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
              backgroundColor: theme.colors.primaryContainer,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon source="layers-triple-outline" size={22} color={theme.colors.onPrimaryContainer} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" style={{ fontWeight: "700" }}>
              Stack Ready
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Move Stack #{stackNumber} to{" "}
              <Text style={{ fontWeight: "700", color: theme.colors.onSurface }}>
                {court?.name}
              </Text>
              ?
            </Text>
          </View>
        </View>

        <Dialog.Content style={{ paddingTop: 16, gap: 12 }}>
          {/* Teams */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {/* Team 1 */}
            <View
              style={{
                flex: 1,
                backgroundColor: TEAM1_COLOR + "0D",
                borderRadius: 10,
                padding: 10,
                gap: 6,
              }}
            >
              <Text
                variant="labelSmall"
                style={{
                  color: TEAM1_COLOR,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Team 1
              </Text>
              {team1Players.map((p, i) => (
                <PlayerRow key={i} player={p} accentColor={TEAM1_COLOR} />
              ))}
            </View>

            {/* VS divider */}
            <View style={{ alignItems: "center", justifyContent: "center", width: 28 }}>
              <View style={{ width: 1, flex: 1, backgroundColor: theme.colors.outlineVariant }} />
              <View style={{ paddingVertical: 4, paddingHorizontal: 2 }}>
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.onSurfaceVariant, fontWeight: "700", fontSize: 10 }}
                >
                  VS
                </Text>
              </View>
              <View style={{ width: 1, flex: 1, backgroundColor: theme.colors.outlineVariant }} />
            </View>

            {/* Team 2 */}
            <View
              style={{
                flex: 1,
                backgroundColor: TEAM2_COLOR + "0D",
                borderRadius: 10,
                padding: 10,
                gap: 6,
              }}
            >
              <Text
                variant="labelSmall"
                style={{
                  color: TEAM2_COLOR,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Team 2
              </Text>
              {team2Players.map((p, i) => (
                <PlayerRow key={i} player={p} accentColor={TEAM2_COLOR} />
              ))}
            </View>
          </View>
        </Dialog.Content>

        <Dialog.Actions>
          <View style={{ flexDirection: "row", gap: 8, flex: 1 }}>
            <Button mode="outlined" onPress={onDismiss} style={{ flex: 1 }}>
              Not Now
            </Button>
            <Button mode="contained" onPress={onConfirm} style={{ flex: 1 }} icon="map-marker-plus-outline">
              Move to Court
            </Button>
          </View>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
