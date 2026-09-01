import { PlayerRating, Stack } from "@/types";
import { formatLastPlayed } from "@/utils/time";
import { differenceInHours, differenceInMinutes } from "date-fns";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import {
  Button,
  Card,
  Chip,
  Icon,
  IconButton,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";

interface StackCardProps {
  stack: Stack;
  index: number;
  getPlayerName: (playerId: string) => string;
  getPlayerRating: (playerId: string) => PlayerRating;
  /** ISO timestamp of the player's last game, or null if they haven't played — same value shown on the Player Card. */
  getPlayerLastPlayed: (playerId: string) => string | null;
  /** True when the given player is lock-paired with someone. */
  isPlayerLocked?: (playerId: string) => boolean;
  /** True when playerIdA and playerIdB were teammates in each other's most recent recorded match — flags a repeat team combo so the admin can shuffle instead. */
  isRepeatTeam?: (playerIdA: string, playerIdB: string) => boolean;
  courtName?: string;
  /** True when this is the stack that will be suggested for the next freed court. */
  isUpNext?: boolean;
  /** True when this stack has been manually pinned to jump the queue. */
  isPinned?: boolean;
  /** True when this stack is tagged as a quorum — locked against per-player removal/move. */
  isQuorum?: boolean;
  /** Whether to show the "Stack" title and queue position badge — the global queue order is confusing when split into group columns. */
  showLabel?: boolean;
  onMorePress: () => void;
  onMoveToCourt: () => void;
  onPlayerPress: (playerId: string, team: 1 | 2) => void;
}

const TEAM1_COLOR = "#DC2626"; // red
const TEAM2_COLOR = "#1D4ED8"; // blue
const REPEAT_WARNING_COLOR = "#B45309"; // amber-700

function formatRating(rating: PlayerRating): string {
  return rating === "NR" ? "NR" : rating.toFixed(1);
}

function formatElapsed(iso: string): string {
  const now = new Date();
  const date = new Date(iso);
  const minutes = differenceInMinutes(now, date);
  if (minutes < 1) return "Just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} mins ago`;
  const hours = differenceInHours(now, date);
  if (hours === 1) return "1 hr ago";
  if (hours < 24) return `${hours} hrs ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

/** Coloured circle with account icon or a dashed empty circle */
function PlayerAvatar({
  playerId,
  getPlayerName,
  getPlayerRating,
  getPlayerLastPlayed,
  isLocked,
  accentColor,
  onPress,
}: {
  playerId?: string;
  getPlayerName: (id: string) => string;
  getPlayerRating: (id: string) => PlayerRating;
  getPlayerLastPlayed: (id: string) => string | null;
  isLocked?: boolean;
  accentColor: string;
  onPress?: () => void;
}) {
  const theme = useTheme();

  if (!playerId) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          opacity: 0.4,
        }}
      >
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            borderWidth: 1.5,
            borderColor: theme.colors.outline,
            borderStyle: "dashed",
          }}
        />
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.outline, fontStyle: "italic" }}
        >
          Empty
        </Text>
      </View>
    );
  }

  const name = getPlayerName(playerId);
  const rating = getPlayerRating(playerId);
  const lastPlayed = getPlayerLastPlayed(playerId);
  return (
    <TouchableRipple
      onPress={onPress}
      borderless
      style={{ borderRadius: 8 }}
      rippleColor={accentColor + "30"}
      testID={`stack-card-player-${playerId}`}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 2,
          paddingHorizontal: 2,
        }}
      >
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: accentColor + "28",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon source="account" size={20} color={accentColor} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurface, flexShrink: 1 }}
              numberOfLines={1}
            >
              {name}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Icon
                source="medal-outline"
                size={11}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                style={{
                  color: theme.colors.onSurfaceVariant,
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                {formatRating(rating)}
              </Text>
            </View>
            <View style={{ flex: 1 }} />
            {isLocked ? (
              <Icon source="lock" size={13} color={accentColor} />
            ) : null}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Icon
                source="clock-outline"
                size={11}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                style={{
                  color: theme.colors.onSurfaceVariant,
                  fontSize: 11,
                }}
                numberOfLines={1}
              >
                {formatLastPlayed(lastPlayed)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableRipple>
  );
}

export default function StackCard({
  stack,
  index,
  getPlayerName,
  getPlayerRating,
  getPlayerLastPlayed,
  isPlayerLocked,
  isRepeatTeam,
  courtName,
  isUpNext,
  isPinned,
  isQuorum,
  showLabel = true,
  onMorePress,
  onMoveToCourt,
  onPlayerPress,
}: StackCardProps) {
  const theme = useTheme();
  const totalPlayers =
    stack.team1.playerIds.length + stack.team2.playerIds.length;
  const isFull = totalPlayers === 4;

  /**
   * A full team's two players flagged as a repeat combo when they're not
   * lock-paired to each other (locking is a deliberate, persistent pairing
   * choice, so it's never a "repeat" warning) and were teammates in their
   * most recent match.
   */
  const isTeamRepeat = (playerIds: string[]) => {
    if (playerIds.length !== 2) return false;
    const [a, b] = playerIds;
    if (isPlayerLocked?.(a) && isPlayerLocked?.(b)) return false;
    return !!isRepeatTeam?.(a, b);
  };
  const team1IsRepeat = isTeamRepeat(stack.team1.playerIds);
  const team2IsRepeat = isTeamRepeat(stack.team2.playerIds);

  // Re-render periodically so the "time elapsed" label stays fresh.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card
      mode="elevated"
      testID={`stack-card-${stack.id}`}
      style={{
        borderLeftWidth: 4,
        borderLeftColor: isFull
          ? theme.colors.primary
          : theme.colors.surfaceVariant,
      }}
    >
      <View className="px-4 pt-3 pb-3">
        {/* Header */}
        <View className="flex-row items-center mb-3">
          {/* Queue position badge */}
          {showLabel && (
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: theme.colors.primaryContainer,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 8,
              }}
            >
              <Text
                variant="labelSmall"
                style={{
                  color: theme.colors.onPrimaryContainer,
                  fontWeight: "700",
                  fontSize: 11,
                }}
              >
                {index}
              </Text>
            </View>
          )}

          <View className="flex-1 flex-row items-center gap-2">
            {showLabel && (
              <Text variant="titleSmall" style={{ fontWeight: "700" }}>
                Stack
              </Text>
            )}
            {stack.type === "winners" && (
              <Chip
                compact
                icon="trophy-outline"
                style={{ backgroundColor: "#FEF9C3" }}
                textStyle={{ color: "#854D0E", fontSize: 11 }}
              >
                Winners
              </Chip>
            )}
            {stack.type === "losers" && (
              <Chip
                compact
                icon="refresh"
                style={{ backgroundColor: "#FEE2E2" }}
                textStyle={{ color: "#991B1B", fontSize: 11 }}
              >
                Losers
              </Chip>
            )}
          </View>

          {isUpNext && (
            <Chip
              compact
              icon={isPinned ? "lock" : "arrow-up-bold-circle-outline"}
              style={{
                backgroundColor: "#FDBA74",
                marginRight: 4,
              }}
              textStyle={{ color: "#7C2D12", fontSize: 11 }}
            >
              Up Next
            </Chip>
          )}

          {isPinned && !isUpNext && (
            <Chip
              compact
              icon="pin"
              style={{
                backgroundColor: "#FDE68A",
                marginRight: 4,
              }}
              textStyle={{ color: "#78350F", fontSize: 11 }}
            >
              Pinned
            </Chip>
          )}

          {isQuorum && (
            <Chip
              compact
              icon="account-group"
              style={{
                backgroundColor: "#E0E7FF",
                marginRight: 4,
              }}
              textStyle={{ color: "#3730A3", fontSize: 11 }}
            >
              Quorum
            </Chip>
          )}

          {isFull && (
            <Chip
              compact
              icon="check-circle-outline"
              style={{
                backgroundColor: theme.colors.primaryContainer,
                marginRight: 4,
              }}
              textStyle={{
                color: theme.colors.onPrimaryContainer,
                fontSize: 12,
              }}
            >
              Ready
            </Chip>
          )}

          <IconButton
            icon="dots-vertical"
            size={20}
            iconColor={theme.colors.onSurfaceVariant}
            onPress={onMorePress}
            testID={`stack-card-menu-${stack.id}`}
          />
        </View>

        {/* Teams side by side */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {/* Team 1 */}
          <View
            style={{
              flex: 1,
              backgroundColor: TEAM1_COLOR + "0D",
              borderRadius: 10,
              padding: 10,
              gap: 8,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
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
              {team1IsRepeat && (
                <View
                  testID={`stack-card-repeat-warning-${stack.id}-team1`}
                  accessibilityLabel="Repeat team from last match"
                >
                  <Icon
                    source="alert-circle"
                    size={14}
                    color={REPEAT_WARNING_COLOR}
                  />
                </View>
              )}
            </View>
            <PlayerAvatar
              playerId={stack.team1.playerIds[0]}
              getPlayerName={getPlayerName}
              getPlayerRating={getPlayerRating}
              getPlayerLastPlayed={getPlayerLastPlayed}
              isLocked={
                stack.team1.playerIds[0]
                  ? isPlayerLocked?.(stack.team1.playerIds[0])
                  : false
              }
              accentColor={TEAM1_COLOR}
              onPress={
                stack.team1.playerIds[0]
                  ? () => onPlayerPress(stack.team1.playerIds[0], 1)
                  : undefined
              }
            />
            <PlayerAvatar
              playerId={stack.team1.playerIds[1]}
              getPlayerName={getPlayerName}
              getPlayerRating={getPlayerRating}
              getPlayerLastPlayed={getPlayerLastPlayed}
              isLocked={
                stack.team1.playerIds[1]
                  ? isPlayerLocked?.(stack.team1.playerIds[1])
                  : false
              }
              accentColor={TEAM1_COLOR}
              onPress={
                stack.team1.playerIds[1]
                  ? () => onPlayerPress(stack.team1.playerIds[1], 1)
                  : undefined
              }
            />
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
            <View
              style={{
                paddingVertical: 4,
                paddingHorizontal: 2,
                backgroundColor: "transparent",
              }}
            >
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
              backgroundColor: TEAM2_COLOR + "0D",
              borderRadius: 10,
              padding: 10,
              gap: 8,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
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
              {team2IsRepeat && (
                <View
                  testID={`stack-card-repeat-warning-${stack.id}-team2`}
                  accessibilityLabel="Repeat team from last match"
                >
                  <Icon
                    source="alert-circle"
                    size={14}
                    color={REPEAT_WARNING_COLOR}
                  />
                </View>
              )}
            </View>
            <PlayerAvatar
              playerId={stack.team2.playerIds[0]}
              getPlayerName={getPlayerName}
              getPlayerRating={getPlayerRating}
              getPlayerLastPlayed={getPlayerLastPlayed}
              isLocked={
                stack.team2.playerIds[0]
                  ? isPlayerLocked?.(stack.team2.playerIds[0])
                  : false
              }
              accentColor={TEAM2_COLOR}
              onPress={
                stack.team2.playerIds[0]
                  ? () => onPlayerPress(stack.team2.playerIds[0], 2)
                  : undefined
              }
            />
            <PlayerAvatar
              playerId={stack.team2.playerIds[1]}
              getPlayerName={getPlayerName}
              getPlayerRating={getPlayerRating}
              getPlayerLastPlayed={getPlayerLastPlayed}
              isLocked={
                stack.team2.playerIds[1]
                  ? isPlayerLocked?.(stack.team2.playerIds[1])
                  : false
              }
              accentColor={TEAM2_COLOR}
              onPress={
                stack.team2.playerIds[1]
                  ? () => onPlayerPress(stack.team2.playerIds[1], 2)
                  : undefined
              }
            />
          </View>
        </View>

        {/* Footer */}
        {courtName ? (
          <Chip
            compact
            icon="map-marker"
            style={{
              alignSelf: "flex-start",
              marginTop: 12,
              backgroundColor: theme.colors.secondaryContainer,
            }}
            textStyle={{
              color: theme.colors.onSecondaryContainer,
              fontSize: 12,
            }}
          >
            {courtName}
          </Chip>
        ) : (
          <Button
            mode={isFull ? "contained" : "outlined"}
            icon="map-marker-plus-outline"
            onPress={onMoveToCourt}
            style={{ marginTop: 12 }}
            disabled={!isFull}
            testID={`stack-card-move-to-court-${stack.id}`}
          >
            Move to Court
          </Button>
        )}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            marginTop: 10,
          }}
        >
          <Icon
            source="clock-outline"
            size={12}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {formatElapsed(stack.createdAt)}
          </Text>
        </View>
      </View>
    </Card>
  );
}
