import { useIsSmallDevice } from "@/hooks/useResponsiveColumns";
import { GameLogEntry, Player } from "@/types";
import { buildGameLog, computeMatchLogStats } from "@/utils/matchLog";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { FlatList, useWindowDimensions, View } from "react-native";
import { Dialog, Divider, Portal, Text, useTheme } from "react-native-paper";

interface AllMatchHistoryDialogProps {
  visible: boolean;
  players: Player[];
  onDismiss: () => void;
}

const WIN_COLOR = "#15803D";
const WIN_BG = "#DCFCE7";
const LOSS_COLOR = "#B91C1C";
const LOSS_BG = "#FEE2E2";
const NUMBER_COL_W = 28;
const TIME_COL_W = 64;
const DURATION_COL_W = 84;

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** A span of time as "1 minute" / "45 minutes" / "1 hour 5 minutes", or "—" when unknown. */
function formatMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "—";
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes === 0) return "< 1 minute";
  if (minutes < 60) return plural(minutes, "minute");
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? plural(hours, "hour")
    : `${plural(hours, "hour")} ${plural(rest, "minute")}`;
}

/** Game length from its start/end times, or "—" when the start wasn't recorded. */
function formatDuration(startIso: string | null, endIso: string): string {
  if (!startIso) return "—";
  return formatMs(new Date(endIso).getTime() - new Date(startIso).getTime());
}

function StatTile({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.primary + "14",
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 6,
        alignItems: "center",
        gap: 2,
      }}
    >
      <MaterialCommunityIcons
        name={icon as any}
        size={16}
        color={theme.colors.primary}
      />
      <Text
        variant="titleMedium"
        style={{
          color: theme.colors.primary,
          fontWeight: "800",
          textAlign: "center",
        }}
      >
        {value}
      </Text>
      <Text
        variant="labelSmall"
        style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Time the game ended (result recorded). No date: a session's games are assumed to be on one day. */
function formatGameTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * One team as "Player1/Player2", tinted green if it won, red if it lost.
 * Inline (tablets) it stays on one line; `wrap` (phones) lets long names
 * wrap at the "/" instead of truncating.
 */
function TeamPill({
  names,
  won,
  wrap = false,
}: {
  names: string;
  won: boolean;
  wrap?: boolean;
}) {
  const color = won ? WIN_COLOR : LOSS_COLOR;
  return (
    <View
      accessibilityLabel={`${names}, ${won ? "won" : "lost"}`}
      style={{
        flexShrink: 1,
        ...(wrap && { alignSelf: "flex-start", maxWidth: "100%" }),
        backgroundColor: won ? WIN_BG : LOSS_BG,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
    >
      <Text
        // Same size as the "vs"/"versus" label between the pills.
        variant="labelMedium"
        style={{ color, fontWeight: "600" }}
        numberOfLines={wrap ? undefined : 1}
      >
        {/* A zero-width space after each "/" gives the line a break point there. */}
        {wrap ? names.replace(/\//g, "/\u200B") : names}
      </Text>
    </View>
  );
}

export default function AllMatchHistoryDialog({
  visible,
  players,
  onDismiss,
}: AllMatchHistoryDialogProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  // Phones are too narrow for "Team1 vs Team2" on one line in the Match
  // column, so the teams stack: Team 1 / versus / Team 2.
  const isSmallDevice = useIsSmallDevice();

  const games = useMemo(
    () => (visible ? buildGameLog(players) : []),
    [visible, players],
  );
  const stats = useMemo(
    () => computeMatchLogStats(players, games),
    [players, games],
  );

  const getPlayerName = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "Removed player";
  const teamNames = (ids: string[]) =>
    ids.length > 0 ? ids.map(getPlayerName).join("/") : "—";

  const columnHeaderStyle = {
    color: theme.colors.onSurfaceVariant,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
  };

  const renderGame = ({
    item,
    index,
  }: {
    item: GameLogEntry;
    index: number;
  }) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 8,
        backgroundColor:
          index % 2 === 0
            ? theme.colors.surface
            : theme.colors.surfaceVariant + "30",
      }}
    >
      <Text
        variant="labelMedium"
        style={{
          width: NUMBER_COL_W,
          color: theme.colors.onSurface,
          fontWeight: "700",
        }}
      >
        #{games.length - index}
      </Text>
      <Text
        variant="labelSmall"
        style={{ width: TIME_COL_W, color: theme.colors.onSurfaceVariant }}
      >
        {formatGameTime(item.date)}
      </Text>
      {/* Teams in court order: Team 1 vs Team 2 (stacked on phones) */}
      <View
        style={{
          flex: 1,
          flexDirection: isSmallDevice ? "column" : "row",
          alignItems: isSmallDevice ? "flex-start" : "center",
          gap: isSmallDevice ? 2 : 6,
        }}
      >
        <TeamPill
          names={teamNames(item.team1Ids)}
          won={item.winningTeam === 1}
          wrap={isSmallDevice}
        />
        <Text
          variant="labelMedium"
          style={{
            color: theme.colors.onSurfaceVariant,
            ...(isSmallDevice && { paddingLeft: 8 }),
          }}
        >
          {isSmallDevice ? "versus" : "vs"}
        </Text>
        <TeamPill
          names={teamNames(item.team2Ids)}
          won={item.winningTeam === 2}
          wrap={isSmallDevice}
        />
      </View>
      <Text
        variant="labelSmall"
        style={{
          width: DURATION_COL_W,
          textAlign: "center",
          color: theme.colors.onSurface,
        }}
        testID="all-match-history-duration"
      >
        {formatDuration(item.gameStartedAt, item.date)}
      </Text>
    </View>
  );

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        testID="all-match-history-dialog"
        style={{
          maxHeight: "85%",
          overflow: "hidden",
          ...(isLandscape && { alignSelf: "center", width: "50%" }),
        }}
      >
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
          <MaterialCommunityIcons name="history" size={24} color="#fff" />
          <Text
            variant="titleMedium"
            style={{
              color: "#fff",
              fontWeight: "800",
              flex: 1,
              letterSpacing: 1,
            }}
          >
            MATCH HISTORY
          </Text>
          <Text
            variant="labelSmall"
            style={{ color: "rgba(255,255,255,0.7)", marginRight: 4 }}
          >
            {games.length} {games.length === 1 ? "game" : "games"}
          </Text>
          <MaterialCommunityIcons
            name="close"
            size={20}
            color="rgba(255,255,255,0.8)"
            onPress={onDismiss}
            testID="all-match-history-close"
          />
        </View>

        {/* Session averages */}
        <View
          style={{ flexDirection: "row", gap: 8, padding: 12 }}
          testID="all-match-history-stats"
        >
          <StatTile
            icon="counter"
            value={
              stats.avgMatchCount === null
                ? "—"
                : String(Math.floor(stats.avgMatchCount))
            }
            label="Average Matches per Player"
          />
          <StatTile
            icon="timer-outline"
            value={formatMs(stats.avgGameMs)}
            label="Average Game Time"
          />
          <StatTile
            icon="timer-sand"
            value={formatMs(stats.avgWaitMs)}
            label="Average Player Wait"
          />
        </View>

        {/* Column headers */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 8,
            gap: 8,
            backgroundColor: theme.colors.surfaceVariant,
          }}
        >
          <Text
            variant="labelSmall"
            style={[columnHeaderStyle, { width: NUMBER_COL_W }]}
          >
            #
          </Text>
          <Text
            variant="labelSmall"
            style={[columnHeaderStyle, { width: TIME_COL_W }]}
          >
            Time
          </Text>
          <Text variant="labelSmall" style={[columnHeaderStyle, { flex: 1 }]}>
            Match
          </Text>
          <Text
            variant="labelSmall"
            style={{
              width: DURATION_COL_W,
              textAlign: "center",
              color: theme.colors.onSurfaceVariant,
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            Duration
          </Text>
        </View>
        <Divider />

        <Dialog.ScrollArea style={{ paddingHorizontal: 0 }}>
          <FlatList
            data={games}
            keyExtractor={(item, i) => `${item.date}-${i}`}
            ItemSeparatorComponent={() => <Divider />}
            ListEmptyComponent={
              <Text
                variant="bodyMedium"
                style={{
                  textAlign: "center",
                  padding: 24,
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                No games played yet.
              </Text>
            }
            renderItem={renderGame}
          />
        </Dialog.ScrollArea>
      </Dialog>
    </Portal>
  );
}
