import { useIsSmallDevice } from "@/hooks/useResponsiveColumns";
import { Player, PlayerRating, StandingRow } from "@/types";
import { computeStandings, describeEdge } from "@/utils/standings";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { FlatList, useWindowDimensions, View } from "react-native";
import { Dialog, Divider, Portal, Text, useTheme } from "react-native-paper";

interface PlayerStandingsDialogProps {
  visible: boolean;
  players: Player[];
  onDismiss: () => void;
}

// Keyed by rank, not row position, so tied players share a medal.
const RANK_MEDAL: Record<number, { icon: string; color: string }> = {
  1: { icon: "medal", color: "#FFD700" },
  2: { icon: "medal", color: "#C0C0C0" },
  3: { icon: "medal", color: "#CD7F32" },
};

export default function PlayerStandingsDialog({
  visible,
  players,
  onDismiss,
}: PlayerStandingsDialogProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const standings: StandingRow[] = useMemo(
    () => computeStandings(players),
    [players],
  );

  // Phones get narrow GP/W/L columns so the name column keeps its room.
  const isSmallDevice = useIsSmallDevice();
  const COL_W = isSmallDevice ? 36 : 56;
  const RANK_W = 44;

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

        {/* How the ranking works */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: theme.colors.primaryContainer,
          }}
          testID="player-standings-legend"
        >
          <MaterialCommunityIcons
            name="information-outline"
            size={14}
            color={theme.colors.onPrimaryContainer}
          />
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onPrimaryContainer, flex: 1 }}
          >
            Ranked by most wins, then fewest losses. Same record, same rank (T).
          </Text>
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
              width: RANK_W,
              textAlign: "center",
              color: theme.colors.onSurfaceVariant,
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            Rank
          </Text>
          <Text
            variant="labelSmall"
            style={{
              flex: 1,
              color: theme.colors.onSurfaceVariant,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginLeft: 4,
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
            {isSmallDevice ? "GP" : "Games"}
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
            {isSmallDevice ? "W" : "Wins"}
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
            {isSmallDevice ? "L" : "Losses"}
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
              const medal = item.rank ? RANK_MEDAL[item.rank] : undefined;
              const isTop = item.rank === 1;
              const edgeText = describeEdge(item);
              return (
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    gap: 2,
                    backgroundColor: isTop
                      ? "#FFD70014"
                      : index % 2 === 0
                        ? theme.colors.surface
                        : theme.colors.surfaceVariant + "30",
                    borderLeftWidth: isTop ? 3 : 0,
                    borderLeftColor: "#FFD700",
                  }}
                >
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                  >
                    {/* Rank: medal for the top 3 ranks, "T" prefix when tied, "—" when unranked (no games) */}
                    <View
                      style={{
                        width: RANK_W,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 2,
                      }}
                      accessibilityLabel={
                        item.rank
                          ? `${item.tied ? "Tied for " : "Rank "}${item.rank}`
                          : "Unranked, no games yet"
                      }
                      testID={`player-standings-rank-${item.player.id}`}
                    >
                      {medal && (
                        <MaterialCommunityIcons
                          name={medal.icon as any}
                          size={16}
                          color={medal.color}
                        />
                      )}
                      <Text
                        variant="labelMedium"
                        style={{
                          color: item.rank
                            ? theme.colors.onSurface
                            : theme.colors.onSurfaceVariant,
                          fontWeight: "700",
                        }}
                      >
                        {item.rank
                          ? `${item.tied ? "T" : ""}${item.rank}`
                          : "—"}
                      </Text>
                    </View>

                    {/* Name + rating */}
                    <View style={{ flex: 1, marginLeft: 4 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text
                          variant="bodyMedium"
                          style={{
                            fontWeight: isTop ? "800" : "600",
                            color: isTop ? theme.colors.primary : theme.colors.onSurface,
                            flexShrink: 1,
                          }}
                          numberOfLines={2}
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

                  {/* Why they're ahead of the next rank, on its own full-width line under the name */}
                  {edgeText && (
                    <Text
                      variant="labelSmall"
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        marginLeft: RANK_W + 8,
                      }}
                      testID={`player-standings-edge-${item.player.id}`}
                    >
                      {edgeText}
                    </Text>
                  )}
                </View>
              );
            }}
          />
        </Dialog.ScrollArea>
      </Dialog>
    </Portal>
  );
}
