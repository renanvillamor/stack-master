import { PlayerRating } from "@/types";
import React from "react";
import { useWindowDimensions, View } from "react-native";
import { Button, Dialog, Icon, Portal, Text, useTheme } from "react-native-paper";

interface PlayerInfo {
  name: string;
  rating: PlayerRating;
}

interface WinnerDialogProps {
  visible: boolean;
  team1Players: PlayerInfo[];
  team2Players: PlayerInfo[];
  onSelectWinner: (team: 1 | 2) => void;
  onDismiss: () => void;
}

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
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 2,
      }}
    >
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

export default function WinnerDialog({
  visible,
  team1Players,
  team2Players,
  onSelectWinner,
  onDismiss,
}: WinnerDialogProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={isLandscape ? { alignSelf: "center", width: "50%" } : undefined}
      >
        <Dialog.Title>🏆 Who won?</Dialog.Title>

        <Dialog.Content>
          {/* Team comparison */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
            {/* Team 1 */}
            <View
              style={{
                flex: 1,
                backgroundColor: theme.colors.primary + "0D",
                borderRadius: 10,
                padding: 12,
                gap: 6,
              }}
            >
              <Text
                variant="labelSmall"
                style={{
                  color: theme.colors.primary,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Team 1
              </Text>
              {team1Players.length > 0 ? (
                team1Players.map((p, i) => (
                  <PlayerRow key={i} player={p} accentColor={theme.colors.primary} />
                ))
              ) : (
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.outline, fontStyle: "italic" }}
                >
                  No players
                </Text>
              )}
            </View>

            {/* VS divider */}
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                width: 28,
              }}
            >
              <View
                style={{
                  width: 1,
                  flex: 1,
                  backgroundColor: theme.colors.outlineVariant,
                }}
              />
              <View style={{ paddingVertical: 4, paddingHorizontal: 2 }}>
                <Text
                  variant="labelSmall"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    fontWeight: "700",
                    fontSize: 10,
                  }}
                >
                  VS
                </Text>
              </View>
              <View
                style={{
                  width: 1,
                  flex: 1,
                  backgroundColor: theme.colors.outlineVariant,
                }}
              />
            </View>

            {/* Team 2 */}
            <View
              style={{
                flex: 1,
                backgroundColor: theme.colors.secondary + "0D",
                borderRadius: 10,
                padding: 12,
                gap: 6,
              }}
            >
              <Text
                variant="labelSmall"
                style={{
                  color: theme.colors.secondary,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Team 2
              </Text>
              {team2Players.length > 0 ? (
                team2Players.map((p, i) => (
                  <PlayerRow key={i} player={p} accentColor={theme.colors.secondary} />
                ))
              ) : (
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.outline, fontStyle: "italic" }}
                >
                  No players
                </Text>
              )}
            </View>
          </View>

          {/* Winner buttons */}
          <View
            style={{
              flexDirection: isLandscape ? "row" : "column",
              gap: 8,
            }}
          >
            <Button
              mode="contained"
              icon="trophy"
              onPress={() => onSelectWinner(1)}
              style={{ flex: isLandscape ? 1 : undefined }}
            >
              Team 1 Won
            </Button>
            <Button
              mode="contained"
              icon="trophy"
              onPress={() => onSelectWinner(2)}
              buttonColor={theme.colors.secondary}
              style={{ flex: isLandscape ? 1 : undefined }}
            >
              Team 2 Won
            </Button>
          </View>
        </Dialog.Content>
      </Dialog>
    </Portal>
  );
}
