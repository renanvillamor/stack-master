import StackCard from "@/components/stack/StackCard";
import { useIsSmallDevice, useResponsiveColumns } from "@/hooks/useResponsiveColumns";
import { useSessionStore } from "@/store/sessionStore";
import { Player, PlayerRating, Stack } from "@/types";
import { getStackGroup } from "@/utils/groupQueue";
import React from "react";
import { FlatList, useWindowDimensions, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

interface GuestGroupColumnProps {
  title: string;
  icon: string;
  color: string;
  backgroundColor: string;
  stacks: Stack[];
  renderCard: (stack: Stack) => React.ReactElement;
}

/** Trimmed read-only counterpart to the Stack screen's GroupColumn — no auto-fill control, since guests never mutate. */
function GuestGroupColumn({
  title,
  icon,
  color,
  backgroundColor,
  stacks,
  renderCard,
}: GuestGroupColumnProps) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 12,
          paddingVertical: 6,
          backgroundColor,
        }}
      >
        <View style={{ alignItems: "center" }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Icon source={icon} size={16} color={color} />
            <Text
              variant="labelMedium"
              numberOfLines={2}
              style={{
                color,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                textAlign: "center",
              }}
            >
              {title}
            </Text>
          </View>
          <Text
            variant="labelSmall"
            style={{ color, opacity: 0.8, marginTop: 2 }}
          >
            {stacks.length} {stacks.length === 1 ? "stack" : "stacks"}
          </Text>
        </View>
      </View>
      <FlatList
        data={stacks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, gap: 12, flexGrow: 1 }}
        renderItem={({ item }) => renderCard(item)}
        ListEmptyComponent={
          <View style={{ paddingVertical: 24, paddingHorizontal: 12 }}>
            <Text
              variant="bodySmall"
              style={{
                color: theme.colors.onSurfaceVariant,
                textAlign: "center",
              }}
            >
              No {title.toLowerCase()} stacks yet
            </Text>
          </View>
        }
      />
    </View>
  );
}

/** Read-only mirror of the Stack screen, sourced from the host's synced snapshot instead of local stores. */
export default function GuestStackView() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const numColumns = useResponsiveColumns();
  const isSmallDevice = useIsSmallDevice();

  const snapshot = useSessionStore((s) => s.remoteSnapshot);
  // Mirrors the host's multi-group setting, not this device's own local
  // preference — the queue layout is the host's call, unlike landscapeColumns
  // (a per-viewer display preference) above.
  const multiGroupStack = snapshot?.multiGroupStack ?? false;
  const players: Player[] = snapshot?.players ?? [];
  const pinnedStackId = snapshot?.pinnedStackId ?? null;
  const quorums = snapshot?.quorums ?? [];
  const queuedStacks = (snapshot?.stacks ?? []).filter((s) => !s.courtId);

  const getPlayerName = (playerId: string) =>
    players.find((p) => p.id === playerId)?.name ?? "Unknown";

  const getPlayerRating = (playerId: string): PlayerRating =>
    players.find((p) => p.id === playerId)?.rating ?? "NR";

  const getPlayerLastPlayed = (playerId: string): string | null =>
    players.find((p) => p.id === playerId)?.lastPlayed ?? null;

  const isPlayerLocked = (playerId: string) =>
    !!players.find((p) => p.id === playerId)?.lockedPartnerId;

  const lastMatchTeammateIds = (playerId: string): string[] => {
    const history = players.find((p) => p.id === playerId)?.history;
    return history?.[history.length - 1]?.teammateIds ?? [];
  };

  const isRepeatTeam = (idA: string, idB: string) =>
    lastMatchTeammateIds(idA).includes(idB) ||
    lastMatchTeammateIds(idB).includes(idA);

  const isStackQuorum = (stackId: string) =>
    quorums.some((q) => q.stackId === stackId);

  // Mirrors stackStore.getNextQueuedStack(): pinned queued stack wins, else the first in queue order.
  const pinnedQueued = queuedStacks.find((s) => s.id === pinnedStackId);
  const suggestedNextStackId = (pinnedQueued ?? queuedStacks[0])?.id ?? null;

  const renderStackCard = (item: Stack) => (
    <StackCard
      stack={item}
      index={queuedStacks.indexOf(item) + 1}
      getPlayerName={getPlayerName}
      getPlayerRating={getPlayerRating}
      getPlayerLastPlayed={getPlayerLastPlayed}
      isPlayerLocked={isPlayerLocked}
      isRepeatTeam={isRepeatTeam}
      isUpNext={item.id === suggestedNextStackId}
      isPinned={item.id === pinnedStackId}
      isQuorum={isStackQuorum(item.id)}
      showLabel={!multiGroupStack}
      readOnly
    />
  );

  const emptyQueueState = (
    <View
      className="flex-1 items-center justify-center py-20"
      style={{ gap: 8 }}
    >
      <Text style={{ fontSize: 40 }}>🎯</Text>
      <Text
        variant="titleMedium"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        Stack is empty
      </Text>
      <Text
        variant="bodyMedium"
        style={{
          color: theme.colors.onSurfaceVariant,
          textAlign: "center",
          paddingHorizontal: 32,
        }}
      >
        The host hasn't queued any players yet.
      </Text>
    </View>
  );

  if (queuedStacks.length === 0) return emptyQueueState;

  if (multiGroupStack) {
    const beginnerStacks = queuedStacks.filter(
      (s) => getStackGroup(s, getPlayerRating) === "beginner",
    );
    const advancedStacks = queuedStacks.filter(
      (s) => getStackGroup(s, getPlayerRating) === "advanced",
    );
    const unsortedStacks = queuedStacks.filter(
      (s) => getStackGroup(s, getPlayerRating) === null,
    );

    return (
      <View style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            flexDirection: isSmallDevice ? "column" : "row",
            paddingHorizontal: 8,
            paddingTop: 8,
          }}
        >
          <GuestGroupColumn
            title="Beginners"
            icon="sprout-outline"
            color="#15803D"
            backgroundColor="#DCFCE7"
            stacks={beginnerStacks}
            renderCard={renderStackCard}
          />
          <View
            style={
              isSmallDevice
                ? {
                    height: 1,
                    backgroundColor: theme.colors.outlineVariant,
                    marginVertical: 8,
                  }
                : {
                    width: 1,
                    backgroundColor: theme.colors.outlineVariant,
                    marginHorizontal: 8,
                  }
            }
          />
          <GuestGroupColumn
            title="Intermediate/Advanced"
            icon="arm-flex-outline"
            color="#3730A3"
            backgroundColor="#E0E7FF"
            stacks={advancedStacks}
            renderCard={renderStackCard}
          />
        </View>
        {unsortedStacks.length > 0 && (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: theme.colors.outlineVariant,
              maxHeight: "35%",
            }}
          >
            <GuestGroupColumn
              title="Unsorted"
              icon="help-circle-outline"
              color={theme.colors.onSurfaceVariant}
              backgroundColor={theme.colors.surfaceVariant}
              stacks={unsortedStacks}
              renderCard={renderStackCard}
            />
          </View>
        )}
      </View>
    );
  }

  type StackListItem = Stack | { _spacer: true; id: string };
  const remainder = queuedStacks.length % numColumns;
  const paddedStacks: StackListItem[] =
    isLandscape && numColumns > 1 && remainder !== 0
      ? [
          ...queuedStacks,
          ...Array.from({ length: numColumns - remainder }, (_, i) => ({
            _spacer: true as const,
            id: `spacer-${i}`,
          })),
        ]
      : queuedStacks;

  return (
    <FlatList
      key={numColumns}
      data={paddedStacks}
      keyExtractor={(item) => item.id}
      numColumns={numColumns}
      contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
      columnWrapperStyle={numColumns > 1 ? { gap: 10 } : undefined}
      renderItem={({ item }) => {
        if ("_spacer" in item) return <View style={{ flex: 1 }} />;
        return <View style={{ flex: 1 }}>{renderStackCard(item)}</View>;
      }}
    />
  );
}
