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
const DURATION_COL_W = 72;

/** A span of time as "45m" / "1h 05m", or "—" when unknown. */
function formatMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "—";
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
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
        variant="titleLarge"
        style={{ color: theme.colors.primary, fontWeight: "800" }}
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

function formatGameDate(iso: string): string {
  const date = new Date(iso);
  return (
    date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " +
    date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

function TeamLine({
  label,
  color,
  backgroundColor,
  names,
}: {
  label: string;
  color: string;
  backgroundColor: string;
  names: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor,
        borderLeftWidth: 3,
        borderLeftColor: color,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
    >
      <Text
        variant="labelSmall"
        style={{ color, fontWeight: "800", width: 36, letterSpacing: 0.5 }}
      >
        {label}
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color, fontWeight: "600", flex: 1 }}
        numberOfLines={1}
      >
        {names}
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
    ids.length > 0 ? ids.map(getPlayerName).join(" / ") : "—";

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
      <View style={{ flex: 1, gap: 4 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSurface, fontWeight: "700" }}
          >
            Game #{games.length - index}
          </Text>
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {formatGameDate(item.date)}
          </Text>
        </View>
        <TeamLine
          label="WIN"
          color={WIN_COLOR}
          backgroundColor={WIN_BG}
          names={teamNames(item.winnerIds)}
        />
        <TeamLine
          label="LOSS"
          color={LOSS_COLOR}
          backgroundColor={LOSS_BG}
          names={teamNames(item.loserIds)}
        />
      </View>
      <Text
        variant="bodyMedium"
        style={{
          width: DURATION_COL_W,
          textAlign: "center",
          color: theme.colors.onSurface,
          fontWeight: "700",
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
                : String(Math.round(stats.avgMatchCount * 10) / 10)
            }
            label="Avg Matches / Player"
          />
          <StatTile
            icon="timer-outline"
            value={formatMs(stats.avgGameMs)}
            label="Avg Game Time"
          />
          <StatTile
            icon="timer-sand"
            value={formatMs(stats.avgWaitMs)}
            label="Avg Player Wait"
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
            style={{
              flex: 1,
              color: theme.colors.onSurfaceVariant,
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            Game
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
