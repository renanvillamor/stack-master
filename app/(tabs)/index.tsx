import ActionBottomSheet, {
  ActionBottomSheetRef,
  ActionItem,
} from "@/components/common/ActionBottomSheet";
import AlertDialog from "@/components/common/AlertDialog";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import WinnerDialog from "@/components/common/WinnerDialog";
import CourtCard from "@/components/court/CourtCard";
import CourtFormModal from "@/components/court/CourtFormModal";
import IncompleteStackPromptDialog from "@/components/court/IncompleteStackPromptDialog";
import NextStackPromptDialog from "@/components/court/NextStackPromptDialog";
import CourtPickerModal from "@/components/stack/CourtPickerModal";
import PlayerPickerDialog from "@/components/stack/PlayerPickerDialog";
import GuestCourtView from "@/components/court/GuestCourtView";
import GuestSessionBanner from "@/components/session/GuestSessionBanner";
import { useCourtStore } from "@/store/courtStore";
import { usePlayerStore } from "@/store/playerStore";
import { useQuorumStore } from "@/store/quorumStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useStackStore } from "@/store/stackStore";
import { Court, Stack } from "@/types";
import { checkQuorumsForPlayers } from "@/utils/quorum";
import { useResponsiveColumns } from "@/hooks/useResponsiveColumns";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { FlatList, useWindowDimensions, View } from "react-native";
import { FAB, Icon, Text, useTheme } from "react-native-paper";

type CourtListItem = Court | { _spacer: true; id: string };

export default function CourtScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { shufflePlayers, autoStackPlayers } = useSettingsStore();
  const isLandscape = width > height;
  const numColumns = useResponsiveColumns();
  const { courts, removeCourt } = useCourtStore();
  const {
    stacks,
    processGameResult,
    returnStackToQueue,
    assignCourtToStack,
    swapPlayersBetweenTeams,
  } = useStackStore();
  const { players, updatePlayerStatus, recordGameResult } = usePlayerStore();
  const { getQuorumForStack, removeQuorum } = useQuorumStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingCourt, setEditingCourt] = useState<Court | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [activeCourt, setActiveCourt] = useState<Court | null>(null);
  const [moveGroupPickerVisible, setMoveGroupPickerVisible] = useState(false);
  const sheetRef = useRef<ActionBottomSheetRef>(null);
  const playerSheetRef = useRef<ActionBottomSheetRef>(null);
  const nextStackCourtRef = useRef<Court | null>(null);
  const [nextStackPrompt, setNextStackPrompt] = useState<{
    court: Court;
    stack: Stack;
  } | null>(null);
  const [incompleteStackPrompt, setIncompleteStackPrompt] = useState<{
    court: Court;
    stack: Stack;
  } | null>(null);
  // Player-level actions — changing which team a player is on mid-game.
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
  const [noSwapCandidates, setNoSwapCandidates] = useState(false);

  const role = useSessionStore((s) => s.role);
  if (role === "guest") {
    return (
      <View className="flex-1 bg-app-bg pt-20">
        <GuestSessionBanner />
        <GuestCourtView />
      </View>
    );
  }

  const getPlayerInfo = (id: string) => {
    const p = players.find((pl) => pl.id === id);
    return {
      id,
      name: p?.name ?? "Unknown",
      rating: p?.rating ?? ("NR" as const),
    };
  };

  const getPlayerName = (id: string) => getPlayerInfo(id).name;

  const isPlayerLocked = (id: string) =>
    !!players.find((p) => p.id === id)?.lockedPartnerId;

  const getActiveStack = (courtId: string) =>
    stacks.find((s) => s.courtId === courtId) ?? null;

  /**
   * After all post-game routing finishes, check the next stack in queue
   * order (as shown on the Stack screen). If it's already full, offer to
   * move it onto the freed court. If it's still short of players, ask the
   * user whether to fill it first or move the next available/complete
   * stack instead.
   */
  const triggerNextStackCheck = () => {
    const court = nextStackCourtRef.current;
    if (!court) return;
    nextStackCourtRef.current = null;
    const nextInOrder = useStackStore.getState().getNextQueuedStack();
    if (!nextInOrder) return;

    const isComplete =
      nextInOrder.team1.playerIds.length +
        nextInOrder.team2.playerIds.length ===
      4;
    if (isComplete) {
      setNextStackPrompt({ court, stack: nextInOrder });
    } else {
      setIncompleteStackPrompt({ court, stack: nextInOrder });
    }
  };

  /** User chose to move the next available/complete stack instead of waiting on the incomplete one. */
  const handleMoveAvailableInstead = () => {
    if (!incompleteStackPrompt) return;
    const { court } = incompleteStackPrompt;
    setIncompleteStackPrompt(null);
    const readyStack = useStackStore.getState().getSuggestedNextStack();
    if (readyStack) setNextStackPrompt({ court, stack: readyStack });
  };

  /** User chose to fill the incomplete stack first — send them to the Stack screen. */
  const handleGoCompleteStack = () => {
    setIncompleteStackPrompt(null);
    router.push("/(tabs)/stack");
  };

  const queuedStacks = stacks.filter((s) => !s.courtId);

  /** Called when the user taps Done on a court card. */
  const handleDone = (court: Court) => setActiveCourt(court);

  /** Called after the user picks a winning team. */
  const handleWinnerSelected = (winnerTeam: 1 | 2) => {
    if (!activeCourt) return;
    const stack = getActiveStack(activeCourt.id);
    if (!stack) return;

    const winnerIds =
      winnerTeam === 1 ? stack.team1.playerIds : stack.team2.playerIds;
    const loserIds =
      winnerTeam === 1 ? stack.team2.playerIds : stack.team1.playerIds;
    const allIds = [...stack.team1.playerIds, ...stack.team2.playerIds];

    nextStackCourtRef.current = activeCourt;
    setActiveCourt(null);

    winnerIds.forEach((id) =>
      recordGameResult(
        id,
        "win",
        winnerIds.filter((w) => w !== id),
        loserIds,
      ),
    );
    loserIds.forEach((id) =>
      recordGameResult(
        id,
        "loss",
        loserIds.filter((l) => l !== id),
        winnerIds,
      ),
    );

    // A quorum expires after its one game — dissolve it before routing
    // these players individually, and before checking whether any of them
    // (or their now-freed teammates) belong to a still-pending quorum.
    const finishedQuorum = getQuorumForStack(stack.id);
    if (finishedQuorum) removeQuorum(finishedQuorum.id);

    if (autoStackPlayers) {
      allIds.forEach((id) => updatePlayerStatus(id, "Stacked"));
      // Single atomic action: removes the game stack and re-queues players.
      // A locked partner who wasn't in this game may get pulled in to
      // reunite with their partner — sync their status too.
      const pulledInIds = processGameResult(
        stack.id,
        winnerIds,
        loserIds,
        shufflePlayers,
      );
      pulledInIds.forEach((id) => updatePlayerStatus(id, "Stacked"));
    } else {
      allIds.forEach((id) => updatePlayerStatus(id, "Available"));
      // Just remove the game stack without re-queuing.
      useStackStore.getState().removeStack(stack.id);
    }

    checkQuorumsForPlayers(allIds);
    triggerNextStackCheck();
  };

  const handleNextStackConfirm = () => {
    if (!nextStackPrompt) return;
    const { court, stack: nextStack } = nextStackPrompt;
    assignCourtToStack(nextStack.id, court.id);
    [...nextStack.team1.playerIds, ...nextStack.team2.playerIds].forEach((id) =>
      updatePlayerStatus(id, "Playing"),
    );
    setNextStackPrompt(null);
  };

  const handleMorePress = (court: Court) => {
    setSelectedCourt(court);
    sheetRef.current?.present();
  };

  /** Called when a player row inside a CourtCard is tapped. */
  const handlePlayerPress = (
    courtId: string,
    playerId: string,
    team: 1 | 2,
  ) => {
    const stack = getActiveStack(courtId);
    if (!stack) return;
    setPlayerTarget({ stackId: stack.id, playerId, team });
    playerSheetRef.current?.present();
  };

  /** Opens the swap picker — the other team is always full mid-game, so a change always requires a swap. */
  const handleChangeTeam = () => {
    if (!playerTarget) return;
    if (isPlayerLocked(playerTarget.playerId)) return;
    const stack = stacks.find((s) => s.id === playerTarget.stackId);
    if (!stack) return;
    const otherTeam =
      playerTarget.team === 1 ? stack.team2.playerIds : stack.team1.playerIds;
    // Locked players are excluded: swapping one in would move it off its
    // partner's team.
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
    setPlayerTarget(null);
  };

  const playerActions: ActionItem[] = [
    {
      label: "Switch Team",
      icon: "swap-horizontal",
      onPress: handleChangeTeam,
      disabled: !!playerTarget && isPlayerLocked(playerTarget.playerId),
      testID: "court-action-switch-team",
    },
  ];

  const handleAdd = () => {
    setEditingCourt(null);
    setModalVisible(true);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      const stack = getActiveStack(deleteTarget);
      if (stack) {
        returnStackToQueue(stack.id);
        const ids = [...stack.team1.playerIds, ...stack.team2.playerIds];
        ids.forEach((id) => updatePlayerStatus(id, "Stacked"));
        checkQuorumsForPlayers(ids);
      }
      removeCourt(deleteTarget);
      setDeleteTarget(null);
    }
  };

  const deleteTargetHasPlayers = !!(deleteTarget && getActiveStack(deleteTarget));

  const emptyCourts = courts.filter(
    (c) => !getActiveStack(c.id) && c.id !== selectedCourt?.id,
  );

  const handleMoveGroup = (targetCourtId: string) => {
    if (!selectedCourt) return;
    const stack = getActiveStack(selectedCourt.id);
    if (!stack) return;
    assignCourtToStack(stack.id, targetCourtId);
    setMoveGroupPickerVisible(false);
  };

  const courtActions: ActionItem[] = [
    {
      label: "Edit",
      icon: "pencil-outline",
      onPress: () => {
        setEditingCourt(selectedCourt);
        setModalVisible(true);
      },
      testID: "court-action-edit",
    },
    ...(selectedCourt && getActiveStack(selectedCourt.id)
      ? [
          {
            label: "Move to Court",
            icon: "swap-horizontal",
            onPress: () => setMoveGroupPickerVisible(true),
            testID: "court-action-move-to-court",
          } as ActionItem,
          {
            label: "Back to Stack",
            icon: "undo",
            onPress: () => {
              const stack = selectedCourt
                ? getActiveStack(selectedCourt.id)
                : null;
              if (stack) {
                returnStackToQueue(stack.id);
                const ids = [
                  ...stack.team1.playerIds,
                  ...stack.team2.playerIds,
                ];
                ids.forEach((id) => updatePlayerStatus(id, "Stacked"));
                checkQuorumsForPlayers(ids);
              }
            },
            testID: "court-action-back-to-stack",
          } as ActionItem,
        ]
      : []),
    {
      label: "Delete",
      icon: "delete-outline",
      destructive: true,
      onPress: () => setDeleteTarget(selectedCourt?.id ?? null),
      testID: "court-action-delete",
    },
  ];

  const inPlayCount = courts.filter((c) => getActiveStack(c.id)).length;

  const remainder = courts.length % numColumns;
  const paddedCourts: CourtListItem[] =
    isLandscape && remainder !== 0
      ? [
          ...courts,
          ...Array.from({ length: numColumns - remainder }, (_, i) => ({
            _spacer: true as const,
            id: `spacer-${i}`,
          })),
        ]
      : courts;

  return (
    <View className="flex-1 bg-app-bg pt-20">
      <FlatList
        key={numColumns}
        data={paddedCourts}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
        columnWrapperStyle={numColumns > 1 ? { gap: 10 } : undefined}
        extraData={{ players, stacks }}
        renderItem={({ item }) => {
          if ("_spacer" in item) {
            return <View style={{ flex: 1 }} />;
          }
          const activeStack = getActiveStack(item.id);
          return (
            <View style={{ flex: 1 }}>
              <CourtCard
                court={item}
                onMorePress={() => handleMorePress(item)}
                onDone={activeStack ? () => handleDone(item) : undefined}
                team1Players={activeStack?.team1.playerIds.map(getPlayerInfo)}
                team2Players={activeStack?.team2.playerIds.map(getPlayerInfo)}
                gameStartedAt={activeStack?.gameStartedAt}
                isPlayerLocked={isPlayerLocked}
                onPlayerPress={(playerId, team) =>
                  handlePlayerPress(item.id, playerId, team)
                }
              />
            </View>
          );
        }}
        ListEmptyComponent={
          <View
            className="flex-1 items-center justify-center py-20"
            style={{ gap: 8 }}
          >
            <Icon
              source="table-tennis"
              size={48}
              color={theme.colors.primary}
            />
            <Text
              variant="titleMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              No courts added yet
            </Text>
            <Text
              variant="bodyMedium"
              style={{
                color: theme.colors.onSurfaceVariant,
                textAlign: "center",
                paddingHorizontal: 32,
              }}
            >
              Tap + to add a court and start managing games.
            </Text>
          </View>
        }
      />

      <FAB
        icon="plus"
        onPress={handleAdd}
        testID="court-add-fab"
        style={{ position: "absolute", bottom: 24, right: 24 }}
      />

      <CourtFormModal
        visible={modalVisible}
        court={editingCourt}
        defaultName={editingCourt ? "" : `Court ${courts.length + 1}`}
        onDismiss={() => setModalVisible(false)}
      />

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Remove Court"
        message={
          deleteTargetHasPlayers
            ? "This court has an active game. Its players will be moved back to the stack. Are you sure you want to remove this court?"
            : "Are you sure you want to remove this court?"
        }
        onConfirm={confirmDelete}
        onDismiss={() => setDeleteTarget(null)}
      />

      <ActionBottomSheet
        ref={sheetRef}
        title={selectedCourt?.name}
        actions={courtActions}
      />

      <CourtPickerModal
        visible={moveGroupPickerVisible}
        courts={emptyCourts}
        onSelect={handleMoveGroup}
        onDismiss={() => setMoveGroupPickerVisible(false)}
      />

      {/* Player action bottom sheet */}
      <ActionBottomSheet
        ref={playerSheetRef}
        title={playerTarget ? getPlayerName(playerTarget.playerId) : undefined}
        actions={playerActions}
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

      <AlertDialog
        visible={noSwapCandidates}
        title="No Valid Candidates"
        message="Everyone on the other team is locked-paired, so there's no one to swap with without breaking a pairing."
        onDismiss={() => setNoSwapCandidates(false)}
      />

      {(() => {
        const activeCourtStack = activeCourt
          ? getActiveStack(activeCourt.id)
          : null;
        return (
          <WinnerDialog
            visible={!!activeCourt && !!activeCourtStack}
            team1Players={(activeCourtStack?.team1.playerIds ?? []).map(
              getPlayerInfo,
            )}
            team2Players={(activeCourtStack?.team2.playerIds ?? []).map(
              getPlayerInfo,
            )}
            onSelectWinner={handleWinnerSelected}
            onDismiss={() => setActiveCourt(null)}
          />
        );
      })()}

      {/* Next ready stack prompt */}
      <NextStackPromptDialog
        court={nextStackPrompt?.court ?? null}
        stack={nextStackPrompt?.stack ?? null}
        stackNumber={
          nextStackPrompt
            ? queuedStacks.findIndex((s) => s.id === nextStackPrompt.stack.id) +
              1
            : 0
        }
        getPlayerInfo={getPlayerInfo}
        onConfirm={handleNextStackConfirm}
        onDismiss={() => setNextStackPrompt(null)}
      />

      {/* Next stack in order is still incomplete */}
      <IncompleteStackPromptDialog
        court={incompleteStackPrompt?.court ?? null}
        stack={incompleteStackPrompt?.stack ?? null}
        stackNumber={
          incompleteStackPrompt
            ? queuedStacks.findIndex(
                (s) => s.id === incompleteStackPrompt.stack.id,
              ) + 1
            : 0
        }
        onCompleteStack={handleGoCompleteStack}
        onMoveAvailableInstead={handleMoveAvailableInstead}
        onDismiss={() => setIncompleteStackPrompt(null)}
      />
    </View>
  );
}
