import { useIsSmallDevice } from "@/hooks/useResponsiveColumns";
import { Court, PlayerRating } from "@/types";
import { differenceInMinutes } from "date-fns";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import {
  Button,
  Card,
  Icon,
  IconButton,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";

interface PlayerInfo {
  id: string;
  name: string;
  rating: PlayerRating;
}

function formatRating(rating: PlayerRating): string {
  return rating === "NR" ? "NR" : rating.toFixed(1);
}

function formatGameElapsed(minutes: number): string {
  if (minutes < 1) return "Just started";
  if (minutes < 60) return `${minutes} min/s elapsed time`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours} hr` : `${hours} hr ${mins} min`;
}

const TEAM1_COLOR = "#DC2626"; // red
const TEAM2_COLOR = "#1D4ED8"; // blue

interface CourtCardProps {
  court: Court;
  onMorePress?: () => void;
  onDone?: () => void;
  team1Players?: PlayerInfo[];
  team2Players?: PlayerInfo[];
  /** Called when a player row is tapped, e.g. to offer changing their team. */
  onPlayerPress?: (playerId: string, team: 1 | 2) => void;
  /** ISO timestamp of when the current game started, or null/undefined if none is in progress. */
  gameStartedAt?: string | null;
  /** True when the given player is lock-paired with someone. */
  isPlayerLocked?: (playerId: string) => boolean;
  /** Guest-viewer mode: hides the more-menu and END GAME button entirely instead of just disabling them. */
  readOnly?: boolean;
}

function PlayerRow({
  player,
  accentColor,
  isLocked,
  onPress,
}: {
  player: PlayerInfo;
  accentColor: string;
  isLocked?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const isSmallDevice = useIsSmallDevice();

  const avatar = (
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
  );
  const nameText = (
    <Text
      variant="bodyMedium"
      style={{ color: theme.colors.onSurface, flex: 1 }}
      numberOfLines={1}
    >
      {player.name}
    </Text>
  );
  const lockIcon = isLocked ? (
    <Icon source="lock" size={13} color={accentColor} />
  ) : null;
  const ratingBadge = (
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
        {formatRating(player.rating)}
      </Text>
    </View>
  );

  return (
    <TouchableRipple
      onPress={onPress}
      borderless
      testID={`court-card-player-${player.id}`}
      style={{ borderRadius: 8 }}
      rippleColor={accentColor + "30"}
    >
      {isSmallDevice ? (
        // Phones: name gets its own full-width row so it doesn't truncate;
        // indicators drop to a second row.
        <View style={{ gap: 2, paddingVertical: 2, paddingHorizontal: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {avatar}
            {nameText}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {ratingBadge}
            <View style={{ flex: 1 }} />
            {lockIcon}
          </View>
        </View>
      ) : (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingVertical: 2,
            paddingHorizontal: 2,
          }}
        >
          {avatar}
          {nameText}
          {lockIcon}
          {ratingBadge}
        </View>
      )}
    </TouchableRipple>
  );
}

function EmptyPlayerSlot() {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        opacity: 0.4,
        paddingVertical: 2,
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
        style={{
          color: theme.colors.outline,
          fontStyle: "italic",
          marginLeft: 2,
          flexShrink: 0,
        }}
      >
        Empty
      </Text>
    </View>
  );
}

export default function CourtCard({
  court,
  onMorePress,
  onDone,
  team1Players,
  team2Players,
  onPlayerPress,
  gameStartedAt,
  isPlayerLocked,
  readOnly = false,
}: CourtCardProps) {
  const theme = useTheme();
  const hasGame = !!team1Players && !!team2Players;

  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!gameStartedAt) return;
    const id = setInterval(() => forceTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [gameStartedAt]);
  const elapsedMinutes = gameStartedAt
    ? differenceInMinutes(new Date(), new Date(gameStartedAt))
    : null;

  return (
    <Card
      mode="elevated"
      testID={`court-card-${court.id}`}
      style={{
        borderLeftWidth: 4,
        borderLeftColor: hasGame
          ? theme.colors.primary
          : theme.colors.surfaceVariant,
      }}
    >
      <View className="px-4 pt-3 pb-3">
        {/* Header — name gets the left half, elapsed time + menu get the right half */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <View style={{ width: "50%", paddingRight: 8 }}>
            <Text
              variant="titleSmall"
              style={{ fontWeight: "700" }}
              numberOfLines={1}
            >
              {court.name}
            </Text>
          </View>
          <View
            style={{
              width: "50%",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 4,
            }}
          >
            {hasGame && elapsedMinutes !== null ? (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant, flexShrink: 1 }}
                numberOfLines={1}
              >
                {formatGameElapsed(elapsedMinutes)}
              </Text>
            ) : null}
            {!readOnly && (
              <IconButton
                icon="dots-vertical"
                size={20}
                iconColor={theme.colors.onSurfaceVariant}
                onPress={onMorePress}
                testID={`court-card-menu-${court.id}`}
                style={{ margin: 0 }}
              />
            )}
          </View>
        </View>

        {/* Teams — always visible */}
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
            {hasGame && team1Players!.length > 0 ? (
              team1Players!.map((p) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  accentColor={TEAM1_COLOR}
                  isLocked={isPlayerLocked?.(p.id)}
                  onPress={
                    onPlayerPress ? () => onPlayerPress(p.id, 1) : undefined
                  }
                />
              ))
            ) : (
              <>
                <EmptyPlayerSlot />
                <EmptyPlayerSlot />
              </>
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
            {hasGame && team2Players!.length > 0 ? (
              team2Players!.map((p) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  accentColor={TEAM2_COLOR}
                  isLocked={isPlayerLocked?.(p.id)}
                  onPress={
                    onPlayerPress ? () => onPlayerPress(p.id, 2) : undefined
                  }
                />
              ))
            ) : (
              <>
                <EmptyPlayerSlot />
                <EmptyPlayerSlot />
              </>
            )}
          </View>
        </View>

        {/* Done button — always visible; disabled when no active game. Hidden entirely in read-only (guest) mode. */}
        {!readOnly && (
          <Button
            mode="contained"
            icon="flag-checkered"
            onPress={onDone}
            disabled={!onDone}
            testID={`court-card-end-game-${court.id}`}
            style={{ marginTop: 12 }}
          >
            END GAME
          </Button>
        )}
      </View>
    </Card>
  );
}
