import ActionBottomSheet, {
  ActionBottomSheetRef,
  ActionItem,
} from "@/components/common/ActionBottomSheet";
import AlertDialog from "@/components/common/AlertDialog";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import OptionPickerSheet, {
  OptionPickerSheetRef,
} from "@/components/common/OptionPickerSheet";
import PlayerCard from "@/components/player/PlayerCard";
import PlayerFormModal from "@/components/player/PlayerFormModal";
import PlayerMatchHistoryDialog from "@/components/player/PlayerMatchHistoryDialog";
import PlayerStandingsDialog from "@/components/player/PlayerStandingsDialog";
import { usePlayerStore } from "@/store/playerStore";
import { useQuorumStore } from "@/store/quorumStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useStackStore } from "@/store/stackStore";
import { Player, PlayerStatus } from "@/types";
import { getPlayerGroup, getStackGroup } from "@/utils/groupQueue";
import { findLockedOutsideQuorum, tryConsolidateQuorum } from "@/utils/quorum";
import { useResponsiveColumns } from "@/hooks/useResponsiveColumns";
import React, { useMemo, useRef, useState } from "react";
import { FlatList, useWindowDimensions, View } from "react-native";
import {
  Button,
  Dialog,
  FAB,
  IconButton,
  Portal,
  Searchbar,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";

export default function PlayerScreen() {
  const { players, removePlayer, updatePlayerStatus, lockPlayers, unlockPlayer } =
    usePlayerStore();
  const {
    stacks,
    addPlayerToStack,
    addPlayersToSpecificStack,
    addManyPlayersToQueue,
  } = useStackStore();
  const { quorums, createQuorum, removeQuorum, removeQuorumForPlayer } =
    useQuorumStore();
  const { multiGroupStack } = useSettingsStore();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const numColumns = useResponsiveColumns();

  const theme = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [historyPlayer, setHistoryPlayer] = useState<Player | null>(null);
  const [standingsVisible, setStandingsVisible] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [lockGroupMismatch, setLockGroupMismatch] = useState(false);
  const [lockQuorumConflict, setLockQuorumConflict] = useState(false);
  const [lockedOutsideQuorum, setLockedOutsideQuorum] = useState<
    { playerId: string; playerName: string; partnerName: string }[] | null
  >(null);
  const [removeQuorumTarget, setRemoveQuorumTarget] = useState<string | null>(
    null,
  );
  const [stackPickerTarget, setStackPickerTarget] = useState<string[] | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "lastPlayed" | "status">(
    "name",
  );
  const [statusFilter, setStatusFilter] = useState<PlayerStatus | "All">("All");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const sheetRef = useRef<ActionBottomSheetRef>(null);
  const bulkSheetRef = useRef<ActionBottomSheetRef>(null);
  const filterSheetRef = useRef<OptionPickerSheetRef>(null);
  const sortSheetRef = useRef<OptionPickerSheetRef>(null);
  const longPressJustFired = useRef(false);

  const selectedPlayer =
    players.find((player) => player.id === selectedPlayerId) ?? null;

  const STATUS_ORDER = {
    Available: 0,
    Idle: 1,
    Stacked: 2,
    Playing: 3,
    Inactive: 4,
  } as const;

  const filteredAndSortedPlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let result = q
      ? players.filter((p) => p.name.toLowerCase().includes(q))
      : [...players];
    if (statusFilter !== "All") {
      result = result.filter((p) => p.status === statusFilter);
    }
    switch (sortBy) {
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "lastPlayed":
        result.sort((a, b) => {
          if (!a.lastPlayed && !b.lastPlayed) return 0;
          if (!a.lastPlayed) return 1;
          if (!b.lastPlayed) return -1;
          return (
            new Date(b.lastPlayed).getTime() - new Date(a.lastPlayed).getTime()
          );
        });
        break;
      case "status":
        result.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
        break;
    }
    return result;
  }, [players, searchQuery, sortBy, statusFilter]);

  const selectionMode = isSelectionMode;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    bulkSheetRef.current?.dismiss();
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const selectAll = () => {
    const allSelected =
      filteredAndSortedPlayers.length > 0 &&
      filteredAndSortedPlayers.every((p) => selectedIds.has(p.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedPlayers.map((p) => p.id)));
    }
  };

  // Long-press enters selection mode; we flag the ref so the subsequent
  // onPress that React Native fires on touch-up is swallowed.
  const handleCardLongPress = (id: string) => {
    longPressJustFired.current = true;
    setIsSelectionMode(true);
    setSelectedIds(new Set([id]));
  };

  const handleCardPress = (id: string, player: Player) => {
    if (longPressJustFired.current) {
      longPressJustFired.current = false;
      return;
    }
    if (selectionMode) {
      toggleSelect(id);
    } else {
      handleMorePress(player);
    }
  };

  const handleMorePress = (player: Player) => {
    setSelectedPlayerId(player.id);
    sheetRef.current?.present();
  };

  const handleIdleToggle = (value: boolean) => {
    if (!selectedPlayer) return;
    if (
      selectedPlayer.status === "Stacked" ||
      selectedPlayer.status === "Playing"
    ) {
      return;
    }

    updatePlayerStatus(selectedPlayer.id, value ? "Idle" : "Available");
  };

  const handleBulkIdleToggle = (value: boolean) => {
    const toggleablePlayers = players.filter(
      (player) =>
        selectedIds.has(player.id) &&
        player.status !== "Stacked" &&
        player.status !== "Playing",
    );

    toggleablePlayers.forEach((player) => {
      updatePlayerStatus(player.id, value ? "Idle" : "Available");
    });
  };

  const handleAdd = () => {
    setEditingPlayer(null);
    setModalVisible(true);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      removePlayer(deleteTarget);
      removeQuorumForPlayer(deleteTarget);
      setDeleteTarget(null);
    }
  };

  const getPlayerName = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "Unknown";

  const getPlayerRatingById = (id: string) =>
    players.find((p) => p.id === id)?.rating ?? "NR";

  const getQuorumForPlayer = (id: string) =>
    quorums.find((q) => q.playerIds.includes(id));

  /**
   * Unassigned stacks (any type) that have room for `count` more players.
   * When multi-group stacking is on and `playerIds` is given, stacks
   * belonging to the other group (beginner vs. non-beginner) are excluded.
   */
  const getFittingStacks = (count: number, playerIds: string[] = []) => {
    const requiredGroup =
      multiGroupStack && playerIds.length > 0
        ? getPlayerGroup(getPlayerRatingById(playerIds[0]))
        : null;
    return stacks.filter((s) => {
      if (s.courtId !== null) return false;
      if (4 - (s.team1.playerIds.length + s.team2.playerIds.length) < count)
        return false;
      if (!requiredGroup) return true;
      const stackGroup = getStackGroup(s, getPlayerRatingById);
      return stackGroup === null || stackGroup === requiredGroup;
    });
  };

  const queuedStacks = stacks.filter((s) => !s.courtId);

  const handleAddToStack = (playerId: string) => {
    const fitting = getFittingStacks(1, [playerId]);
    if (fitting.length === 0) {
      addPlayerToStack(playerId);
      updatePlayerStatus(playerId, "Stacked");
    } else if (fitting.length === 1) {
      addPlayersToSpecificStack(fitting[0].id, [playerId]);
      updatePlayerStatus(playerId, "Stacked");
    } else {
      setStackPickerTarget([playerId]);
    }
  };

  const handleBulkAddToStack = () => {
    const availablePlayers = players.filter(
      (p) => selectedIds.has(p.id) && p.status === "Available",
    );
    if (availablePlayers.length === 0) return;

    if (multiGroupStack) {
      const beginnerIds = availablePlayers
        .filter((p) => getPlayerGroup(p.rating) === "beginner")
        .map((p) => p.id);
      const advancedIds = availablePlayers
        .filter((p) => getPlayerGroup(p.rating) === "advanced")
        .map((p) => p.id);
      const batches = [beginnerIds, advancedIds].filter((b) => b.length > 0);

      if (batches.length > 1) {
        // Selection spans both groups — route each group's players as its
        // own batch so they spread across as many stacks as needed (no
        // manual cross-group picker), while keeping locked pairs together.
        batches.forEach((ids) => {
          addManyPlayersToQueue(ids);
          ids.forEach((id) => updatePlayerStatus(id, "Stacked"));
        });
        clearSelection();
        return;
      }
    }

    const playerIds = availablePlayers.map((p) => p.id);
    const fitting = getFittingStacks(playerIds.length, playerIds);
    if (fitting.length === 0) {
      addManyPlayersToQueue(playerIds);
      playerIds.forEach((id) => updatePlayerStatus(id, "Stacked"));
      clearSelection();
    } else if (fitting.length === 1) {
      addPlayersToSpecificStack(fitting[0].id, playerIds);
      playerIds.forEach((id) => updatePlayerStatus(id, "Stacked"));
      clearSelection();
    } else {
      // Show picker — don't clear selection yet
      setStackPickerTarget(playerIds);
    }
  };

  const handlePickStack = (stackId: string) => {
    if (!stackPickerTarget) return;
    addPlayersToSpecificStack(stackId, stackPickerTarget);
    stackPickerTarget.forEach((id) => updatePlayerStatus(id, "Stacked"));
    setStackPickerTarget(null);
    clearSelection();
  };

  const handlePickNewStack = () => {
    if (!stackPickerTarget) return;
    addManyPlayersToQueue(stackPickerTarget);
    stackPickerTarget.forEach((id) => {
      updatePlayerStatus(id, "Stacked");
    });
    setStackPickerTarget(null);
    clearSelection();
  };

  const confirmBulkDelete = () => {
    selectedIds.forEach((id) => {
      removePlayer(id);
      removeQuorumForPlayer(id);
    });
    clearSelection();
    setPendingBulkDelete(false);
  };

  const handleLockSelectedPair = () => {
    const [idA, idB] = Array.from(selectedIds);
    if (!idA || !idB) return;

    if (getQuorumForPlayer(idA) || getQuorumForPlayer(idB)) {
      setLockQuorumConflict(true);
      return;
    }

    if (multiGroupStack) {
      const playerA = players.find((p) => p.id === idA);
      const playerB = players.find((p) => p.id === idB);
      if (
        playerA &&
        playerB &&
        getPlayerGroup(playerA.rating) !== getPlayerGroup(playerB.rating)
      ) {
        setLockGroupMismatch(true);
        return;
      }
    }

    lockPlayers(idA, idB);
    clearSelection();
  };

  const handleUnlockSelectedPair = () => {
    const [idA] = Array.from(selectedIds);
    if (!idA) return;
    unlockPlayer(idA);
    clearSelection();
  };

  const selectedPairIsLocked =
    selectedIds.size === 2 &&
    (() => {
      const [idA, idB] = Array.from(selectedIds);
      return players.find((p) => p.id === idA)?.lockedPartnerId === idB;
    })();

  const handleCreateQuorum = () => {
    const ids = Array.from(selectedIds);
    if (ids.length !== 4) return;

    const conflicts = findLockedOutsideQuorum(ids, players);
    if (conflicts.length > 0) {
      setLockedOutsideQuorum(conflicts);
      return;
    }

    const quorumId = createQuorum(ids);
    tryConsolidateQuorum(quorumId);
    clearSelection();
  };

  const handleRemoveFromQuorum = () => {
    if (!selectedPlayer) return;
    const quorum = getQuorumForPlayer(selectedPlayer.id);
    if (quorum) setRemoveQuorumTarget(quorum.id);
  };

  const lockedPartnerName = selectedPlayer?.lockedPartnerId
    ? getPlayerName(selectedPlayer.lockedPartnerId)
    : null;

  const playerActions: ActionItem[] = [
    {
      label: "Edit",
      icon: "pencil-outline",
      testID: "player-action-edit",
      onPress: () => {
        setEditingPlayer(selectedPlayer);
        setModalVisible(true);
      },
    },
    {
      label: "Match History",
      icon: "history",
      testID: "player-action-history",
      onPress: () => setHistoryPlayer(selectedPlayer),
    },
    {
      label: "Idle",
      icon: "power-sleep",
      type: "switch",
      value: selectedPlayer?.status === "Idle",
      onValueChange: handleIdleToggle,
      disabled:
        selectedPlayer?.status === "Stacked" ||
        selectedPlayer?.status === "Playing",
      testID: "player-action-idle",
    },
    // Only allow adding to stack when player is Available
    ...(selectedPlayer?.status === "Available"
      ? [
          {
            label: "Add to Stack",
            icon: "layers-plus",
            testID: "player-action-add-to-stack",
            onPress: () => {
              if (selectedPlayer) {
                handleAddToStack(selectedPlayer.id);
              }
            },
          } as ActionItem,
        ]
      : []),
    ...(selectedPlayer?.lockedPartnerId
      ? [
          {
            label: `Unlock Pairing (${lockedPartnerName})`,
            icon: "lock-open-variant-outline",
            testID: "player-action-unlock",
            onPress: () => {
              if (selectedPlayer) unlockPlayer(selectedPlayer.id);
            },
          } as ActionItem,
        ]
      : []),
    ...(selectedPlayer && getQuorumForPlayer(selectedPlayer.id)
      ? [
          {
            label: "Remove from Quorum",
            icon: "account-group-outline",
            testID: "player-action-remove-quorum",
            onPress: handleRemoveFromQuorum,
          } as ActionItem,
        ]
      : []),
    {
      label: "Delete",
      icon: "delete-outline",
      destructive: true,
      testID: "player-action-delete",
      onPress: () => setDeleteTarget(selectedPlayer?.id ?? null),
    },
  ];

  const availableSelectedCount = players.filter(
    (p) => selectedIds.has(p.id) && p.status === "Available",
  ).length;

  const selectedPlayers = players.filter((player) => selectedIds.has(player.id));
  const bulkIdleEligiblePlayers = selectedPlayers.filter(
    (player) => player.status !== "Stacked" && player.status !== "Playing",
  );
  const bulkIdleEnabled = bulkIdleEligiblePlayers.length > 0;
  const bulkIdleValue =
    bulkIdleEnabled &&
    bulkIdleEligiblePlayers.every((player) => player.status === "Idle");

  const bulkPlayerActions: ActionItem[] = [
    {
      label: "Idle",
      icon: "power-sleep",
      type: "switch",
      value: bulkIdleValue,
      onValueChange: handleBulkIdleToggle,
      disabled: !bulkIdleEnabled,
      testID: "player-bulk-action-idle",
    },
    ...(availableSelectedCount > 0
      ? [
          {
            label: `Add to Stack (${availableSelectedCount})`,
            icon: "layers-plus",
            testID: "player-bulk-action-add-to-stack",
            onPress: handleBulkAddToStack,
          } as ActionItem,
        ]
      : []),
    ...(selectedIds.size === 2
      ? [
          selectedPairIsLocked
            ? ({
                label: "Unlock Pair",
                icon: "lock-open-variant-outline",
                testID: "player-bulk-action-unlock-pair",
                onPress: handleUnlockSelectedPair,
              } as ActionItem)
            : ({
                label: "Lock Pair",
                icon: "lock-outline",
                testID: "player-bulk-action-lock-pair",
                onPress: handleLockSelectedPair,
              } as ActionItem),
        ]
      : []),
    ...(selectedIds.size === 4 &&
    Array.from(selectedIds).every((id) => !getQuorumForPlayer(id))
      ? [
          {
            label: "Create Quorum",
            icon: "account-group-outline",
            testID: "player-bulk-action-create-quorum",
            onPress: handleCreateQuorum,
          } as ActionItem,
        ]
      : []),
    {
      label: "Delete",
      icon: "delete-outline",
      destructive: true,
      testID: "player-bulk-action-delete",
      onPress: () => setPendingBulkDelete(true),
    },
  ];

  const availableCount = players.filter((p) => p.status === "Available").length;
  const idleCount = players.filter((p) => p.status === "Idle").length;
  const playingCount = players.filter((p) => p.status === "Playing").length;
  const stackedCount = players.filter((p) => p.status === "Stacked").length;

  type PlayerListItem = Player | { _spacer: true; id: string };
  const remainder = filteredAndSortedPlayers.length % numColumns;
  const paddedPlayers: PlayerListItem[] =
    isLandscape && numColumns > 1 && remainder !== 0
      ? [
          ...filteredAndSortedPlayers,
          ...Array.from({ length: numColumns - remainder }, (_, i) => ({
            _spacer: true as const,
            id: `spacer-${i}`,
          })),
        ]
      : filteredAndSortedPlayers;

  return (
    <View className="flex-1 bg-app-bg pt-20">
      {selectionMode ? (
        <View
          className="flex-row items-center px-2"
          style={{ backgroundColor: theme.colors.primaryContainer }}
        >
          <IconButton
            icon="close"
            size={20}
            onPress={clearSelection}
            iconColor={theme.colors.onPrimaryContainer}
            testID="player-selection-close"
          />
          <Text
            variant="titleSmall"
            className="flex-1"
            style={{ color: theme.colors.onPrimaryContainer }}
          >
            {selectedIds.size} selected
          </Text>
          <IconButton
            icon={
              filteredAndSortedPlayers.length > 0 &&
              filteredAndSortedPlayers.every((p) => selectedIds.has(p.id))
                ? "checkbox-marked-outline"
                : "checkbox-blank-outline"
            }
            size={20}
            onPress={selectAll}
            iconColor={theme.colors.onPrimaryContainer}
            testID="player-selection-toggle-all"
          />
          <IconButton
            icon="account-cog-outline"
            size={20}
            onPress={() => bulkSheetRef.current?.present()}
            iconColor={theme.colors.onPrimaryContainer}
            testID="player-selection-manage"
          />
        </View>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 4,
          gap: 4,
        }}
      >
        <Searchbar
          placeholder="Search players..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={{ flex: 1, height: 44 }}
          inputStyle={{ fontSize: 14, minHeight: 0 }}
          testID="player-search"
        />
        <View style={{ position: "relative" }}>
          <IconButton
            icon="filter-variant"
            size={22}
            onPress={() => filterSheetRef.current?.present()}
            iconColor={
              statusFilter !== "All"
                ? theme.colors.primary
                : theme.colors.onSurfaceVariant
            }
            style={{
              backgroundColor:
                statusFilter !== "All"
                  ? theme.colors.primaryContainer
                  : undefined,
            }}
            testID="player-filter-button"
          />
          {statusFilter !== "All" && (
            <View
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: theme.colors.primary,
              }}
            />
          )}
        </View>
        <IconButton
          icon="sort"
          size={22}
          onPress={() => sortSheetRef.current?.present()}
          iconColor={
            sortBy !== "name"
              ? theme.colors.primary
              : theme.colors.onSurfaceVariant
          }
          testID="player-sort-button"
        />
        <IconButton
          icon="trophy"
          size={22}
          onPress={() => setStandingsVisible(true)}
          iconColor="#FFD700"
          style={{ backgroundColor: "#FFD70020" }}
          testID="player-standings-button"
        />
      </View>

      <FlatList
        key={numColumns}
        data={paddedPlayers}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
        columnWrapperStyle={numColumns > 1 ? { gap: 10 } : undefined}
        renderItem={({ item }) => {
          if ("_spacer" in item) return <View style={{ flex: 1 }} />;
          return (
            <View style={{ flex: 1 }}>
              <PlayerCard
                player={item}
                selected={selectedIds.has(item.id)}
                selectionMode={selectionMode}
                lockedPartnerName={
                  item.lockedPartnerId
                    ? getPlayerName(item.lockedPartnerId)
                    : null
                }
                inQuorum={!!getQuorumForPlayer(item.id)}
                onPress={() => handleCardPress(item.id, item)}
                onLongPress={() => handleCardLongPress(item.id)}
              />
            </View>
          );
        }}
        ListEmptyComponent={
          <View
            className="flex-1 items-center justify-center py-20"
            style={{ gap: 8 }}
          >
            {players.length === 0 ? (
              <>
                <Text style={{ fontSize: 40 }}>🏃</Text>
                <Text
                  variant="titleMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  No players yet
                </Text>
                <Text
                  variant="bodyMedium"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    textAlign: "center",
                    paddingHorizontal: 32,
                  }}
                >
                  Tap + to add players, then long-press to select and add them
                  to the stack.
                </Text>
              </>
            ) : (
              <>
                <IconButton
                  icon="account-search-outline"
                  size={40}
                  iconColor={theme.colors.onSurfaceVariant}
                />
                <Text
                  variant="titleMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  No matching players
                </Text>
                <Text
                  variant="bodyMedium"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    textAlign: "center",
                    paddingHorizontal: 32,
                  }}
                >
                  {searchQuery && statusFilter !== "All"
                    ? `No ${statusFilter.toLowerCase()} players matching "${searchQuery}".`
                    : searchQuery
                      ? `No players matching "${searchQuery}".`
                      : `No ${statusFilter.toLowerCase()} players.`}
                </Text>
              </>
            )}
          </View>
        }
      />

      <FAB
        icon="plus"
        onPress={handleAdd}
        style={{ position: "absolute", bottom: 24, right: 24 }}
        testID="player-add-fab"
      />

      <PlayerFormModal
        visible={modalVisible}
        player={editingPlayer}
        onDismiss={() => setModalVisible(false)}
      />

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Remove Player"
        message="Are you sure you want to remove this player?"
        onConfirm={confirmDelete}
        onDismiss={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        visible={pendingBulkDelete}
        title="Remove Players"
        message={`Remove ${selectedIds.size} player${selectedIds.size === 1 ? "" : "s"}?`}
        onConfirm={confirmBulkDelete}
        onDismiss={() => setPendingBulkDelete(false)}
      />

      <AlertDialog
        visible={lockGroupMismatch}
        title="Skill Level Mismatch"
        message="Locked pairs must be the same skill level — both Beginner or both Intermediate/Advanced. Update their ratings so the levels match, then try locking them again."
        onDismiss={() => setLockGroupMismatch(false)}
      />

      <AlertDialog
        visible={lockQuorumConflict}
        title="Player in a Quorum"
        message="One of the selected players already belongs to a quorum. Remove them from the quorum before locking a pairing."
        onDismiss={() => setLockQuorumConflict(false)}
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

      <ConfirmDialog
        visible={!!removeQuorumTarget}
        title="Remove Quorum"
        message="This will remove the quorum for all 4 players. Continue?"
        confirmLabel="Remove"
        onConfirm={() => {
          if (removeQuorumTarget) removeQuorum(removeQuorumTarget);
          setRemoveQuorumTarget(null);
        }}
        onDismiss={() => setRemoveQuorumTarget(null)}
      />

      <ActionBottomSheet
        ref={sheetRef}
        title={selectedPlayer?.name}
        actions={playerActions}
      />

      <ActionBottomSheet
        ref={bulkSheetRef}
        title={`${selectedIds.size} selected`}
        actions={bulkPlayerActions}
      />

      <PlayerStandingsDialog
        visible={standingsVisible}
        players={players}
        onDismiss={() => setStandingsVisible(false)}
      />

      <PlayerMatchHistoryDialog
        player={historyPlayer}
        getPlayerName={getPlayerName}
        onDismiss={() => setHistoryPlayer(null)}
      />

      <OptionPickerSheet
        ref={filterSheetRef}
        title="Filter by Status"
        testIDPrefix="status-filter"
        options={[
          { value: "All", label: "All Players", icon: "account-group-outline" },
          {
            value: "Available",
            label: "Available",
            icon: "account-check-outline",
          },
          { value: "Idle", label: "Idle", icon: "power-sleep" },
          { value: "Stacked", label: "Stacked", icon: "layers-outline" },
          { value: "Playing", label: "Playing", icon: "play-circle-outline" },
          { value: "Inactive", label: "Inactive", icon: "account-off-outline" },
        ]}
        selectedValue={statusFilter}
        onSelect={(v) => setStatusFilter(v as PlayerStatus | "All")}
      />

      <OptionPickerSheet
        ref={sortSheetRef}
        title="Sort by"
        testIDPrefix="sort-by"
        options={[
          { value: "name", label: "Name", icon: "sort-alphabetical-ascending" },
          { value: "lastPlayed", label: "Last Played", icon: "clock-outline" },
          { value: "status", label: "Status", icon: "account-circle-outline" },
        ]}
        selectedValue={sortBy}
        onSelect={(v) => setSortBy(v as "name" | "lastPlayed" | "status")}
      />

      {/* Stack picker — shown when multiple fitting stacks exist */}
      <Portal>
        <Dialog
          visible={!!stackPickerTarget}
          onDismiss={() => setStackPickerTarget(null)}
          style={isLandscape ? { alignSelf: "center", width: "50%" } : undefined}
          testID="player-stack-picker-dialog"
        >
          <Dialog.Title>Add to Stack</Dialog.Title>
          <Dialog.Content style={{ gap: 8 }}>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}
            >
              Choose a stack to join:
            </Text>
            {getFittingStacks(
              stackPickerTarget?.length ?? 1,
              stackPickerTarget ?? [],
            ).map((stack) => {
              const total =
                stack.team1.playerIds.length + stack.team2.playerIds.length;
              const stackIndex =
                queuedStacks.findIndex((s) => s.id === stack.id) + 1;
              const names = [...stack.team1.playerIds, ...stack.team2.playerIds]
                .map(getPlayerName)
                .join(", ");
              return (
                <TouchableRipple
                  key={stack.id}
                  onPress={() => handlePickStack(stack.id)}
                  borderless
                  style={{ borderRadius: 10 }}
                  testID={`player-stack-picker-item-${stack.id}`}
                >
                  <View
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      backgroundColor: theme.colors.primaryContainer + "60",
                      gap: 2,
                    }}
                  >
                    <Text variant="titleSmall" style={{ fontWeight: "700" }}>
                      Stack #{stackIndex} · {total}/4 players
                    </Text>
                    {names ? (
                      <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.onSurfaceVariant }}
                        numberOfLines={1}
                      >
                        {names}
                      </Text>
                    ) : null}
                  </View>
                </TouchableRipple>
              );
            })}
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setStackPickerTarget(null)}
              testID="player-stack-picker-cancel"
            >
              Cancel
            </Button>
            <Button
              onPress={handlePickNewStack}
              testID="player-stack-picker-new"
            >
              New Stack
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
