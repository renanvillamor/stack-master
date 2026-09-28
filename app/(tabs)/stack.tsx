import ActionBottomSheet, {
  ActionBottomSheetRef,
  ActionItem,
} from "@/components/common/ActionBottomSheet";
import AlertDialog from "@/components/common/AlertDialog";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import CourtPickerModal from "@/components/stack/CourtPickerModal";
import MoveToStackDialog from "@/components/stack/MoveToStackDialog";
import PlayerPickerDialog from "@/components/stack/PlayerPickerDialog";
import StackCard from "@/components/stack/StackCard";
import GuestStackView from "@/components/stack/GuestStackView";
import PlayerMatchHistoryDialog from "@/components/player/PlayerMatchHistoryDialog";
import GuestSessionBanner from "@/components/session/GuestSessionBanner";
import { useCourtStore } from "@/store/courtStore";
import { usePlayerStore } from "@/store/playerStore";
import { useQuorumStore } from "@/store/quorumStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useStackStore } from "@/store/stackStore";
import { Player, PlayerRating, Stack } from "@/types";
import { getStackGroup } from "@/utils/groupQueue";
import { findLockedOutsideQuorum } from "@/utils/quorum";
import { useIsSmallDevice, useResponsiveColumns } from "@/hooks/useResponsiveColumns";
import React, { useRef, useState } from "react";
import { FlatList, useWindowDimensions, View } from "react-native";
import { Button, Icon, IconButton, Text, useTheme } from "react-native-paper";

interface GroupColumnProps {
  title: string;
  icon: string;
  color: string;
  backgroundColor: string;
  stacks: Stack[];
  renderCard: (stack: Stack) => React.ReactElement;
  /** Shows a per-column "Auto-fill" button when true. Omit entirely for columns (e.g. Unsorted) that shouldn't offer it. */
  canAutoFill?: boolean;
  onAutoFill?: () => void;
  testID?: string;
  /** Forwarded to the internal FlatList so cards re-render when player data (e.g. a renamed player) changes without the stacks themselves changing. */
  extraData?: unknown;
}

/** One half of the beginner/advanced split queue — its own header and independently scrolling list. */
function GroupColumn({
  title,
  icon,
  color,
  backgroundColor,
  stacks,
  renderCard,
  canAutoFill,
  onAutoFill,
  testID,
  extraData,
}: GroupColumnProps) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 6,
          backgroundColor,
        }}
      >
        <View style={{ flex: 1, alignItems: "center" }}>
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
                flexShrink: 1,
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
        {canAutoFill && (
          <IconButton
            icon="auto-fix"
            size={18}
            mode="contained-tonal"
            iconColor={color}
            onPress={onAutoFill}
            style={{ margin: 0 }}
            testID={testID}
          />
        )}
      </View>
      <FlatList
        data={stacks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, gap: 12, flexGrow: 1 }}
        extraData={extraData}
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

export default function StackScreen() {
  const {
    stacks,
    removeStack,
    assignCourtToStack,
    movePlayerBetweenTeams,
    swapPlayersBetweenTeams,
    removeSinglePlayerFromStack,
    movePlayerBetweenStacks,
    movePlayerToNewStack,
    swapPlayersBetweenStacks,
    getNextQueuedStack,
    autoFillQueue,
    canAutoFillQueue,
    pinnedStackId,
    setPinnedStack,
  } = useStackStore();
  const { courts, addCourt } = useCourtStore();
  const { players, updatePlayerStatus } = usePlayerStore();
  const { quorums, createQuorum, removeQuorum, removeQuorumForStack } =
    useQuorumStore();
  const { multiGroupStack } = useSettingsStore();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const numColumns = useResponsiveColumns();
  const isSmallDevice = useIsSmallDevice();

  const [selectedStack, setSelectedStack] = useState<Stack | null>(null);
  const [clearTarget, setClearTarget] = useState<string | null>(null);
  const [courtPickerStack, setCourtPickerStack] = useState<Stack | null>(null);
  // Player-level actions
  const [playerTarget, setPlayerTarget] = useState<{
    stackId: string;
    playerId: string;
    team: 1 | 2;
  } | null>(null);
  const [swapDialog, setSwapDialog] = useState<{
    stackId: string;
    movingId: string;
    candidates: string[];
  } | null>(null);
  const [removePlayerTarget, setRemovePlayerTarget] = useState<{
    stackId: string;
    playerId: string;
  } | null>(null);
  const [historyPlayer, setHistoryPlayer] = useState<Player | null>(null);
  const [moveToStackDialog, setMoveToStackDialog] = useState<{
    fromStackId: string;
    playerId: string;
  } | null>(null);
  const [pendingSwap, setPendingSwap] = useState<{
    fromStackId: string;
    movingId: string;
    toStackId: string;
    targetPlayerId: string;
  } | null>(null);
  const [pairMoveNoSpace, setPairMoveNoSpace] = useState(false);
  const [noSwapCandidates, setNoSwapCandidates] = useState(false);
  const [lockedOutsideQuorum, setLockedOutsideQuorum] = useState<
    { playerId: string; playerName: string; partnerName: string }[] | null
  >(null);
  const [quorumMemberConflict, setQuorumMemberConflict] = useState(false);
  const sheetRef = useRef<ActionBottomSheetRef>(null);
  const playerSheetRef = useRef<ActionBottomSheetRef>(null);
  const theme = useTheme();

  const role = useSessionStore((s) => s.role);
  if (role === "guest") {
    return (
      <View className="flex-1 bg-app-bg pt-20">
        <GuestSessionBanner />
        <GuestStackView />
      </View>
    );
  }

  const getPlayerName = (playerId: string) =>
    players.find((p) => p.id === playerId)?.name ?? "Unknown";

  const getPlayerRating = (playerId: string): PlayerRating =>
    players.find((p) => p.id === playerId)?.rating ?? "NR";

  const getPlayerLastPlayed = (playerId: string): string | null =>
    players.find((p) => p.id === playerId)?.lastPlayed ?? null;

  const isPlayerLocked = (playerId: string) =>
    !!players.find((p) => p.id === playerId)?.lockedPartnerId;

  /** Ids of playerId's teammates in their most recently recorded match, or none if they haven't played yet. */
  const lastMatchTeammateIds = (playerId: string): string[] => {
    const history = players.find((p) => p.id === playerId)?.history;
    return history?.[history.length - 1]?.teammateIds ?? [];
  };

  /** True when idA and idB were teammates in their most recent match — a repeat team combo worth flagging. */
  const isRepeatTeam = (idA: string, idB: string) =>
    lastMatchTeammateIds(idA).includes(idB) ||
    lastMatchTeammateIds(idB).includes(idA);

  const getQuorumForStack = (stackId: string) =>
    quorums.find((q) => q.stackId === stackId);

  const isStackQuorum = (stackId: string) => !!getQuorumForStack(stackId);

  const getCourtName = (courtId: string | null) =>
    courtId ? courts.find((c) => c.id === courtId)?.name : undefined;

  /** Courts that don't already have a stack assigned to them. */
  const availableCourts = courts.filter(
    (c) => !stacks.some((s) => s.courtId === c.id),
  );

  const handleMorePress = (stack: Stack) => {
    setSelectedStack(stack);
    sheetRef.current?.present();
  };

  const handleMoveToCourt = (stack: Stack) => {
    // No courts at all — auto-create "Court 1" and assign immediately
    if (courts.length === 0) {
      addCourt("Court 1");
      const newCourt = useCourtStore.getState().courts[0];
      handleCourtSelect(newCourt.id, stack);
      return;
    }
    if (availableCourts.length === 1) {
      // Only one option — skip the picker and assign immediately
      setCourtPickerStack(stack);
      handleCourtSelect(availableCourts[0].id, stack);
    } else {
      setCourtPickerStack(stack);
    }
  };

  /** Called when a player avatar inside a StackCard is tapped. */
  const handlePlayerPress = (
    stackId: string,
    playerId: string,
    team: 1 | 2,
  ) => {
    setPlayerTarget({ stackId, playerId, team });
    playerSheetRef.current?.present();
  };

  /** Switch team or open swap picker. */
  const handleSwitchTeam = () => {
    if (!playerTarget) return;
    if (isPlayerLocked(playerTarget.playerId)) return;
    const stack = stacks.find((s) => s.id === playerTarget.stackId);
    if (!stack) return;
    const otherTeam =
      playerTarget.team === 1 ? stack.team2.playerIds : stack.team1.playerIds;
    if (otherTeam.length < 2) {
      movePlayerBetweenTeams(playerTarget.stackId, playerTarget.playerId);
    } else {
      // Other team is full — ask which player to swap with. Locked players
      // are excluded: swapping one in would move it off its partner's team.
      const candidates = otherTeam.filter((id) => !isPlayerLocked(id));
      if (candidates.length === 0) {
        setNoSwapCandidates(true);
        setPlayerTarget(null);
        return;
      }
      setSwapDialog({
        stackId: playerTarget.stackId,
        movingId: playerTarget.playerId,
        candidates,
      });
    }
    setPlayerTarget(null);
  };

  const handleCourtSelect = (courtId: string, stackOverride?: Stack) => {
    const target = stackOverride ?? courtPickerStack;
    if (!target) return;
    assignCourtToStack(target.id, courtId);
    const ids = [...target.team1.playerIds, ...target.team2.playerIds];
    ids.forEach((id) => updatePlayerStatus(id, "Playing"));
    setCourtPickerStack(null);
  };

  const freeStackPlayers = (stack: Stack) => {
    const ids = [...stack.team1.playerIds, ...stack.team2.playerIds];
    ids.forEach((id) => updatePlayerStatus(id, "Available"));
  };

  const confirmClearStack = () => {
    if (!clearTarget) return;
    const removed = removeStack(clearTarget);
    if (removed) freeStackPlayers(removed);
    removeQuorumForStack(clearTarget);
    setClearTarget(null);
  };

  const stackIndex = selectedStack
    ? stacks.findIndex((s) => s.id === selectedStack.id) + 1
    : 0;

  const selectedStackQuorum = selectedStack
    ? getQuorumForStack(selectedStack.id)
    : undefined;
  const selectedStackFull = selectedStack
    ? selectedStack.team1.playerIds.length +
        selectedStack.team2.playerIds.length ===
      4
    : false;
  const selectedStackPlayerIds = selectedStack
    ? [...selectedStack.team1.playerIds, ...selectedStack.team2.playerIds]
    : [];

  const handleMarkAsQuorum = () => {
    if (!selectedStack) return;
    const conflicts = findLockedOutsideQuorum(selectedStackPlayerIds, players);
    if (conflicts.length > 0) {
      setLockedOutsideQuorum(conflicts);
      return;
    }
    if (selectedStackPlayerIds.some((id) => quorums.find((q) => q.playerIds.includes(id)))) {
      setQuorumMemberConflict(true);
      return;
    }
    createQuorum(selectedStackPlayerIds, selectedStack.id);
  };

  const stackActions: ActionItem[] = [
    selectedStack && selectedStack.id === pinnedStackId
      ? {
          label: "Unpin from Up Next",
          icon: "pin-off-outline",
          onPress: () => setPinnedStack(null),
          testID: "stack-action-unpin",
        }
      : {
          label: "Set as Up Next",
          icon: "pin-outline",
          onPress: () => setPinnedStack(selectedStack?.id ?? null),
          testID: "stack-action-set-up-next",
        },
    selectedStackQuorum
      ? {
          label: "Remove Quorum",
          icon: "account-group-outline",
          onPress: () => removeQuorum(selectedStackQuorum.id),
          testID: "stack-action-remove-quorum",
        }
      : {
          label: "Mark as Quorum",
          icon: "account-group-outline",
          onPress: handleMarkAsQuorum,
          disabled: !selectedStackFull,
          testID: "stack-action-mark-quorum",
        },
    {
      label: "Clear Stack",
      icon: "playlist-remove",
      onPress: () => setClearTarget(selectedStack?.id ?? null),
      testID: "stack-action-clear",
    },
  ];

  /** Locked partner queued elsewhere — the store moves the pair as a unit, so target selection is a whole-card tap rather than a per-player swap pick. */
  const isPairedMove = (playerId: string) => {
    const partnerId = players.find((p) => p.id === playerId)?.lockedPartnerId;
    return (
      !!partnerId &&
      queuedStacks.some(
        (s) =>
          s.team1.playerIds.includes(partnerId) ||
          s.team2.playerIds.includes(partnerId),
      )
    );
  };

  const handleMoveToStack = (toStackId: string) => {
    if (!moveToStackDialog) return;
    const { fromStackId, playerId } = moveToStackDialog;

    if (isPairedMove(playerId)) {
      // Pair-aware move — the store aborts (and we surface an error) if
      // there's no room for both partners on one team of the destination.
      const moved = movePlayerBetweenStacks(fromStackId, playerId, toStackId);
      setMoveToStackDialog(null);
      if (!moved) setPairMoveNoSpace(true);
      return;
    }

    // Only reachable when the destination has an open seat — full stacks
    // require picking a specific player to swap with instead (see
    // handleSelectSwapTarget), so this is a direct, unambiguous move.
    movePlayerBetweenStacks(fromStackId, playerId, toStackId);
    setMoveToStackDialog(null);
  };

  /** User tapped a specific occupied player in a full target stack — stage the swap for confirmation instead of applying it immediately. */
  const handleSelectSwapTarget = (toStackId: string, targetPlayerId: string) => {
    if (!moveToStackDialog) return;
    setPendingSwap({
      fromStackId: moveToStackDialog.fromStackId,
      movingId: moveToStackDialog.playerId,
      toStackId,
      targetPlayerId,
    });
    setMoveToStackDialog(null);
  };

  const confirmPendingSwap = () => {
    if (!pendingSwap) return;
    swapPlayersBetweenStacks(
      pendingSwap.fromStackId,
      pendingSwap.movingId,
      pendingSwap.toStackId,
      pendingSwap.targetPlayerId,
    );
    setPendingSwap(null);
  };

  const handleCreateNewStack = () => {
    if (!moveToStackDialog) return;
    const { fromStackId, playerId } = moveToStackDialog;
    const fromStack = stacks.find((s) => s.id === fromStackId);
    movePlayerToNewStack(fromStackId, playerId, fromStack?.type ?? "default");
    setMoveToStackDialog(null);
  };

  const playerActions: ActionItem[] = [
    {
      label: "Switch Team",
      icon: "swap-horizontal",
      onPress: handleSwitchTeam,
      disabled: !!playerTarget && isPlayerLocked(playerTarget.playerId),
      testID: "stack-player-action-switch-team",
    },
    {
      label: "Match History",
      icon: "history",
      onPress: () => {
        if (playerTarget) {
          setHistoryPlayer(
            players.find((p) => p.id === playerTarget.playerId) ?? null,
          );
        }
        setPlayerTarget(null);
      },
      testID: "stack-player-action-history",
    },
    {
      label: "Move to Stack",
      icon: "swap-vertical",
      disabled: !!playerTarget && isStackQuorum(playerTarget.stackId),
      onPress: () => {
        if (playerTarget) {
          setMoveToStackDialog({
            fromStackId: playerTarget.stackId,
            playerId: playerTarget.playerId,
          });
        }
        setPlayerTarget(null);
      },
      testID: "stack-player-action-move-to-stack",
    },
    {
      label: "Remove from Stack",
      icon: "account-minus-outline",
      destructive: true,
      disabled: !!playerTarget && isStackQuorum(playerTarget.stackId),
      onPress: () => {
        if (playerTarget) {
          setRemovePlayerTarget({
            stackId: playerTarget.stackId,
            playerId: playerTarget.playerId,
          });
        }
        setPlayerTarget(null);
      },
      testID: "stack-player-action-remove-from-stack",
    },
  ];

  /** Only unassigned stacks belong in the queue list. */
  const queuedStacks = stacks.filter((s) => !s.courtId);
  const waitingPlayers = queuedStacks.reduce(
    (sum, s) => sum + s.team1.playerIds.length + s.team2.playerIds.length,
    0,
  );
  const readyCount = queuedStacks.filter(
    (s) => s.team1.playerIds.length + s.team2.playerIds.length === 4,
  ).length;

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

  const suggestedNextStackId = getNextQueuedStack()?.id ?? null;
  // Multi-group stacking splits the queue into its own Beginners/Advanced
  // buttons (rendered per-column below) instead of one combined button.
  const canAutoFill = multiGroupStack ? false : canAutoFillQueue();
  const canAutoFillBeginner = multiGroupStack
    ? canAutoFillQueue("beginner")
    : false;
  const canAutoFillAdvanced = multiGroupStack
    ? canAutoFillQueue("advanced")
    : false;

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
      onMorePress={() => handleMorePress(item)}
      onMoveToCourt={() => handleMoveToCourt(item)}
      onPlayerPress={(playerId, team) =>
        handlePlayerPress(item.id, playerId, team)
      }
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
        Long-press players on the Player tab and tap "Add to Stack" to fill
        the stack.
      </Text>
    </View>
  );

  // When multi-group stacking is on, split the queue into its own
  // beginner/advanced columns regardless of orientation or landscapeColumns,
  // since keeping the two groups visually separate matters more here than
  // card density.
  const beginnerStacks = multiGroupStack
    ? queuedStacks.filter(
        (s) => getStackGroup(s, getPlayerRating) === "beginner",
      )
    : [];
  const advancedStacks = multiGroupStack
    ? queuedStacks.filter(
        (s) => getStackGroup(s, getPlayerRating) === "advanced",
      )
    : [];
  const unsortedStacks = multiGroupStack
    ? queuedStacks.filter((s) => getStackGroup(s, getPlayerRating) === null)
    : [];

  return (
    <View className="flex-1 bg-app-bg pt-20">
      {canAutoFill && (
        <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}>
          <Button mode="contained-tonal" icon="auto-fix" onPress={() => autoFillQueue()} testID="stack-autofill">
            Auto-fill vacant slots
          </Button>
        </View>
      )}
      {queuedStacks.length === 0 ? (
        emptyQueueState
      ) : multiGroupStack ? (
        <View style={{ flex: 1 }}>
          <View
            style={{
              flex: 1,
              flexDirection: isSmallDevice ? "column" : "row",
              paddingHorizontal: 8,
              paddingTop: 8,
            }}
          >
            <GroupColumn
              title="Beginners"
              icon="sprout-outline"
              color="#15803D"
              backgroundColor="#DCFCE7"
              stacks={beginnerStacks}
              renderCard={renderStackCard}
              canAutoFill={canAutoFillBeginner}
              onAutoFill={() => autoFillQueue("beginner")}
              testID="stack-autofill-beginner"
              extraData={players}
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
            <GroupColumn
              title="Intermediate/Advanced"
              icon="arm-flex-outline"
              color="#3730A3"
              backgroundColor="#E0E7FF"
              stacks={advancedStacks}
              renderCard={renderStackCard}
              canAutoFill={canAutoFillAdvanced}
              onAutoFill={() => autoFillQueue("advanced")}
              testID="stack-autofill-advanced"
              extraData={players}
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
              <GroupColumn
                title="Unsorted"
                icon="help-circle-outline"
                color={theme.colors.onSurfaceVariant}
                backgroundColor={theme.colors.surfaceVariant}
                stacks={unsortedStacks}
                renderCard={renderStackCard}
                extraData={players}
              />
            </View>
          )}
        </View>
      ) : (
        <FlatList
          key={numColumns}
          data={paddedStacks}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
          columnWrapperStyle={numColumns > 1 ? { gap: 10 } : undefined}
          extraData={players}
          renderItem={({ item }) => {
            if ("_spacer" in item) return <View style={{ flex: 1 }} />;
            return <View style={{ flex: 1 }}>{renderStackCard(item)}</View>;
          }}
        />
      )}

      <ActionBottomSheet
        ref={sheetRef}
        title={selectedStack ? `Stack #${stackIndex}` : undefined}
        actions={stackActions}
      />

      <ConfirmDialog
        visible={!!clearTarget}
        title="Clear Stack"
        message="Remove all players from this stack? They will be marked as Available."
        confirmLabel="Clear"
        destructive={false}
        onConfirm={confirmClearStack}
        onDismiss={() => setClearTarget(null)}
      />

      <CourtPickerModal
        visible={courtPickerStack !== null}
        courts={availableCourts}
        onSelect={handleCourtSelect}
        onDismiss={() => setCourtPickerStack(null)}
      />

      {/* Player action bottom sheet */}
      <ActionBottomSheet
        ref={playerSheetRef}
        title={playerTarget ? getPlayerName(playerTarget.playerId) : undefined}
        actions={playerActions}
      />

      <PlayerMatchHistoryDialog
        player={historyPlayer}
        getPlayerName={getPlayerName}
        onDismiss={() => setHistoryPlayer(null)}
      />

      <PlayerPickerDialog
        visible={!!swapDialog}
        candidates={swapDialog?.candidates ?? []}
        getPlayerName={getPlayerName}
        onSelect={(candidateId: string) => {
          if (!swapDialog) return;
          swapPlayersBetweenTeams(
            swapDialog.stackId,
            swapDialog.movingId,
            candidateId,
          );
          setSwapDialog(null);
        }}
        onDismiss={() => setSwapDialog(null)}
      />

      {/* Remove single player confirm */}
      <ConfirmDialog
        visible={!!removePlayerTarget}
        title="Remove Player"
        message={
          removePlayerTarget && isPlayerLocked(removePlayerTarget.playerId)
            ? `Remove ${getPlayerName(removePlayerTarget.playerId)} and their locked partner from the stack? They will be marked as Available.`
            : `Remove ${removePlayerTarget ? getPlayerName(removePlayerTarget.playerId) : ""} from the stack? They will be marked as Available.`
        }
        confirmLabel="Remove"
        onConfirm={() => {
          if (!removePlayerTarget) return;
          const removedIds = removeSinglePlayerFromStack(
            removePlayerTarget.stackId,
            removePlayerTarget.playerId,
          );
          removedIds.forEach((id) => updatePlayerStatus(id, "Available"));
          setRemovePlayerTarget(null);
        }}
        onDismiss={() => setRemovePlayerTarget(null)}
      />

      <MoveToStackDialog
        visible={!!moveToStackDialog}
        queuedStacks={queuedStacks.filter((s) => !isStackQuorum(s.id))}
        fromStackId={moveToStackDialog?.fromStackId ?? null}
        movingPlayerName={
          moveToStackDialog ? getPlayerName(moveToStackDialog.playerId) : undefined
        }
        pairedMove={
          moveToStackDialog ? isPairedMove(moveToStackDialog.playerId) : false
        }
        getPlayerName={getPlayerName}
        getPlayerRating={getPlayerRating}
        isPlayerLocked={isPlayerLocked}
        onSelectStack={handleMoveToStack}
        onSelectSwapTarget={handleSelectSwapTarget}
        onCreateNewStack={handleCreateNewStack}
        onDismiss={() => setMoveToStackDialog(null)}
      />

      <ConfirmDialog
        visible={!!pendingSwap}
        title="Confirm Swap"
        message={
          pendingSwap
            ? `Swap ${getPlayerName(pendingSwap.movingId)} with ${getPlayerName(pendingSwap.targetPlayerId)}?`
            : ""
        }
        confirmLabel="Swap"
        destructive={false}
        onConfirm={confirmPendingSwap}
        onDismiss={() => setPendingSwap(null)}
      />

      <AlertDialog
        visible={pairMoveNoSpace}
        title="No Space Available"
        message="That stack doesn't have room for the locked pair on the same team. Pick a different stack or free up space first."
        onDismiss={() => setPairMoveNoSpace(false)}
      />

      <AlertDialog
        visible={noSwapCandidates}
        title="No Valid Candidates"
        message="Everyone on the other team is locked-paired, so there's no one to swap with without breaking a pairing."
        onDismiss={() => setNoSwapCandidates(false)}
      />

      <AlertDialog
        visible={!!lockedOutsideQuorum}
        title="Locked Pairing"
        message={
          lockedOutsideQuorum
            ?.map(
              (c) =>
                `${c.playerName} is currently lock-paired with ${c.partnerName}. Remove the lock-pairing before including ${c.playerName} in a quorum.`,
            )
            .join("\n\n") ?? ""
        }
        onDismiss={() => setLockedOutsideQuorum(null)}
      />

      <AlertDialog
        visible={quorumMemberConflict}
        title="Player in Another Quorum"
        message="One or more players in this stack already belong to another quorum."
        onDismiss={() => setQuorumMemberConflict(false)}
      />

    </View>
  );
}
