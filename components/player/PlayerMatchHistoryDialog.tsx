import { MatchRecord, Player } from "@/types";
import React from "react";
import { FlatList, useWindowDimensions, View } from "react-native";
import {
  Button,
  Chip,
  Dialog,
  Divider,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";

interface PlayerMatchHistoryDialogProps {
  player: Player | null;
  getPlayerName: (id: string) => string;
  onDismiss: () => void;
}

/**
 * One game from this player's side: result chip, then partner and opponents
 * on their own lines (names wrap rather than truncate on phones), with the
 * time and date stacked on the right. The player's own name is the dialog
 * title, so it isn't repeated here.
 */
function HistoryRow({
  record,
  getPlayerName,
}: {
  record: MatchRecord;
  getPlayerName: (id: string) => string;
}) {
  const theme = useTheme();
  const isWin = record.result === "win";
  const date = new Date(record.date);
  const timeStr = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const dateStr = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  const teammates = (record.teammateIds ?? []).map(getPlayerName).join(" / ");
  const opponents = (record.opponentIds ?? []).map(getPlayerName).join(" / ");

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 4,
        gap: 10,
      }}
    >
      <Chip
        compact
        style={{
          backgroundColor: isWin
            ? theme.colors.primary + "22"
            : theme.colors.error + "18",
        }}
        textStyle={{
          color: isWin ? theme.colors.primary : theme.colors.error,
          fontWeight: "700",
          fontSize: 11,
        }}
      >
        {isWin ? "WIN" : "LOSS"}
      </Chip>
      <View style={{ flex: 1, gap: 2 }}>
        {!!teammates && (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>with </Text>
            {teammates}
          </Text>
        )}
        {!!opponents && (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>vs </Text>
            {opponents}
          </Text>
        )}
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurface }}>
          {timeStr}
        </Text>
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {dateStr}
        </Text>
      </View>
    </View>
  );
}

export default function PlayerMatchHistoryDialog({
  player,
  getPlayerName,
  onDismiss,
}: PlayerMatchHistoryDialogProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  if (!player) return null;

  const history = [...(player.history ?? [])].reverse();
  const wins = player.history?.filter((r) => r.result === "win").length ?? 0;
  const losses = player.history?.filter((r) => r.result === "loss").length ?? 0;

  return (
    <Portal>
      <Dialog
        visible={!!player}
        onDismiss={onDismiss}
        style={isLandscape ? { alignSelf: "center", width: "50%" } : undefined}
        testID="player-history-dialog"
      >
        <Dialog.Title>{player.name}</Dialog.Title>

        <Dialog.Content style={{ paddingBottom: 0 }}>
          {/* Summary row */}
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: theme.colors.primary + "18",
                borderRadius: 10,
                padding: 10,
                alignItems: "center",
              }}
            >
              <Text
                variant="headlineSmall"
                style={{ color: theme.colors.primary, fontWeight: "700" }}
              >
                {wins}
              </Text>
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.primary }}
              >
                Wins
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: theme.colors.error + "12",
                borderRadius: 10,
                padding: 10,
                alignItems: "center",
              }}
            >
              <Text
                variant="headlineSmall"
                style={{ color: theme.colors.error, fontWeight: "700" }}
              >
                {losses}
              </Text>
              <Text variant="labelSmall" style={{ color: theme.colors.error }}>
                Losses
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: theme.colors.surfaceVariant,
                borderRadius: 10,
                padding: 10,
                alignItems: "center",
              }}
            >
              <Text
                variant="headlineSmall"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  fontWeight: "700",
                }}
              >
                {player.matches}
              </Text>
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Total
              </Text>
            </View>
          </View>

          <Divider />

          {history.length === 0 ? (
            <Text
              variant="bodyMedium"
              style={{
                color: theme.colors.onSurfaceVariant,
                textAlign: "center",
                paddingVertical: 24,
              }}
            >
              No games played yet.
            </Text>
          ) : (
            <FlatList
              data={history}
              keyExtractor={(_, i) => String(i)}
              style={{ maxHeight: 240 }}
              ItemSeparatorComponent={() => <Divider />}
              renderItem={({ item }) => (
                <HistoryRow record={item} getPlayerName={getPlayerName} />
              )}
            />
          )}
        </Dialog.Content>

        <Dialog.Actions>
          <Button onPress={onDismiss} testID="player-history-close">
            Close
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
