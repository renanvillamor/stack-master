import CourtCard from "@/components/court/CourtCard";
import { useResponsiveColumns } from "@/hooks/useResponsiveColumns";
import { useSessionStore } from "@/store/sessionStore";
import { Court } from "@/types";
import React from "react";
import { FlatList, useWindowDimensions, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

type CourtListItem = Court | { _spacer: true; id: string };

/** Read-only mirror of the Court screen, sourced from the host's synced snapshot instead of local stores. */
export default function GuestCourtView() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const numColumns = useResponsiveColumns();

  const snapshot = useSessionStore((s) => s.remoteSnapshot);
  const courts = snapshot?.courts ?? [];
  const stacks = snapshot?.stacks ?? [];
  const players = snapshot?.players ?? [];

  const getPlayerInfo = (id: string) => {
    const p = players.find((pl) => pl.id === id);
    return {
      id,
      name: p?.name ?? "Unknown",
      rating: p?.rating ?? ("NR" as const),
    };
  };

  const isPlayerLocked = (id: string) =>
    !!players.find((p) => p.id === id)?.lockedPartnerId;

  const getActiveStack = (courtId: string) =>
    stacks.find((s) => s.courtId === courtId) ?? null;

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
    <FlatList
      key={numColumns}
      data={paddedCourts}
      keyExtractor={(item) => item.id}
      numColumns={numColumns}
      contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
      columnWrapperStyle={numColumns > 1 ? { gap: 10 } : undefined}
      renderItem={({ item }) => {
        if ("_spacer" in item) {
          return <View style={{ flex: 1 }} />;
        }
        const activeStack = getActiveStack(item.id);
        return (
          <View style={{ flex: 1 }}>
            <CourtCard
              court={item}
              readOnly
              team1Players={activeStack?.team1.playerIds.map(getPlayerInfo)}
              team2Players={activeStack?.team2.playerIds.map(getPlayerInfo)}
              gameStartedAt={activeStack?.gameStartedAt}
              isPlayerLocked={isPlayerLocked}
            />
          </View>
        );
      }}
      ListEmptyComponent={
        <View
          className="flex-1 items-center justify-center py-20"
          style={{ gap: 8 }}
        >
          <Icon source="table-tennis" size={48} color={theme.colors.primary} />
          <Text
            variant="titleMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            No courts yet
          </Text>
          <Text
            variant="bodyMedium"
            style={{
              color: theme.colors.onSurfaceVariant,
              textAlign: "center",
              paddingHorizontal: 32,
            }}
          >
            The host hasn't added any courts yet.
          </Text>
        </View>
      }
    />
  );
}
