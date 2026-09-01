import { Player, PlayerRating } from "@/types";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { FlatList, useWindowDimensions, View } from "react-native";
import { Dialog, Divider, Portal, Text, useTheme } from "react-native-paper";

interface PlayerStandingsDialogProps {
  visible: boolean;
  players: Player[];
  onDismiss: () => void;
}

interface StandingRow {
  player: Player;
  wins: number;
  losses: number;
  matches: number;
}

const RANK_MEDAL: Record<number, { icon: string; color: string }> = {
  0: { icon: "medal", color: "#FFD700" },
  1: { icon: "medal", color: "#C0C0C0" },
  2: { icon: "medal", color: "#CD7F32" },
};

export default function PlayerStandingsDialog({
  visible,
  players,
  onDismiss,
}: PlayerStandingsDialogProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const standings: StandingRow[] = useMemo(() => {
    return players
      .map((player) => ({
        player,
        wins: player.history.filter((r) => r.result === "win").length,
        losses: player.history.filter((r) => r.result === "loss").length,
        matches: player.matches,
      }))
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.matches !== a.matches) return b.matches - a.matches;
        return a.player.name.localeCompare(b.player.name);
      });
  }, [players]);

  const COL_W = 64;

  function formatRating(rating: PlayerRating): string {
    return rating === "NR" ? "NR" : rating.toFixed(1);
  }

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        testID="player-standings-dialog"
        style={{
          maxHeight: "85%",
          overflow: "hidden",
          ...(isLandscape && { alignSelf: "center", width: "50%" }),
        }}
      >
        {/* Scoreboard header */}
        <View
          style={{
            backgroundColor: theme.colors.primary,
            paddingVertical: 16,
            paddingHorizontal: 20,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <MaterialCommunityIcons name="trophy" size={24} color="#FFD700" />
          <Text
            variant="titleMedium"
            style={{ color: "#fff", fontWeight: "800", flex: 1, letterSpacing: 1 }}
          >
            STANDINGS
          </Text>
          <Text
            variant="labelSmall"
            style={{ color: "rgba(255,255,255,0.7)", marginRight: 4 }}
          >
            {players.length} players
          </Text>
          <MaterialCommunityIcons
            name="close"
            size={20}
            color="rgba(255,255,255,0.8)"
            onPress={onDismiss}
            testID="player-standings-close"
          />
        </View>

        {/* Column headers */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: theme.colors.surfaceVariant,
          }}
        >
          <Text
            variant="labelSmall"
            style={{
              flex: 1,
              color: theme.colors.onSurfaceVariant,
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            Player
          </Text>
          <Text
            variant="labelSmall"
            style={{
              width: COL_W,
              textAlign: "center",
              color: theme.colors.onSurfaceVariant,
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            Matches
          </Text>
          <Text
            variant="labelSmall"
            style={{
              width: COL_W,
              textAlign: "center",
              color: "#15803D",
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            Wins
          </Text>
          <Text
            variant="labelSmall"
            style={{
              width: COL_W,
              textAlign: "center",
              color: "#B91C1C",
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            Losses
          </Text>
        </View>
        <Divider />

        <Dialog.ScrollArea style={{ paddingHorizontal: 0 }}>
          <FlatList
            data={standings}
            keyExtractor={(item) => item.player.id}
            ListEmptyComponent={
              <Text
                variant="bodyMedium"
                style={{
                  textAlign: "center",
                  padding: 24,
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                No match history yet.
              </Text>
            }
            renderItem={({ item, index }) => {
              const medal = RANK_MEDAL[index];
              const isTop = index === 0;
              return (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    gap: 4,
                    backgroundColor: isTop
                      ? "#FFD70014"
                      : index % 2 === 0
                        ? theme.colors.surface
                        : theme.colors.surfaceVariant + "30",
                    borderLeftWidth: isTop ? 3 : 0,
                    borderLeftColor: "#FFD700",
                  }}
                >
                  {/* Rank / medal */}
                  <View
                    style={{
                      width: 28,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {medal ? (
                      <MaterialCommunityIcons
                        name={medal.icon as any}
                        size={20}
                        color={medal.color}
                      />
                    ) : (
                      <Text
                        variant="labelSmall"
                        style={{ color: theme.colors.onSurfaceVariant }}
                      >
                        {index + 1}
                      </Text>
                    )}
                  </View>

                  {/* Name + rating */}
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text
                      variant="bodyMedium"
                      style={{
                        fontWeight: isTop ? "800" : "600",
                        color: isTop ? theme.colors.primary : theme.colors.onSurface,
                        flexShrink: 1,
                      }}
                      numberOfLines={1}
                    >
                      {item.player.name}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                      <MaterialCommunityIcons
                        name="medal-outline"
                        size={11}
                        color={theme.colors.onSurfaceVariant}
                      />
                      <Text
                        variant="labelSmall"
                        style={{ color: theme.colors.onSurfaceVariant, fontWeight: "600" }}
                      >
                        {formatRating(item.player.rating)}
                      </Text>
                    </View>
                  </View>

                  {/* Matches */}
                  <Text
                    variant="bodyMedium"
                    style={{
                      width: COL_W,
                      textAlign: "center",
                      color: theme.colors.onSurfaceVariant,
                      fontWeight: "600",
                    }}
                  >
                    {item.matches}
                  </Text>

                  {/* Wins */}
                  <Text
                    variant="bodyMedium"
                    style={{
                      width: COL_W,
                      textAlign: "center",
                      color: "#15803D",
                      fontWeight: "700",
                    }}
                  >
                    {item.wins}
                  </Text>

                  {/* Losses */}
                  <Text
                    variant="bodyMedium"
                    style={{
                      width: COL_W,
                      textAlign: "center",
                      color: "#B91C1C",
                      fontWeight: "700",
                    }}
                  >
                    {item.losses}
                  </Text>
                </View>
              );
            }}
          />
        </Dialog.ScrollArea>
      </Dialog>
    </Portal>
  );
}
