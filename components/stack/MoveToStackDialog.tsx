import { useSettingsStore } from "@/store/settingsStore";
import { PlayerRating, Stack } from "@/types";
import React from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import {
  Button,
  Card,
  Chip,
  Dialog,
  Icon,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";

interface MoveToStackDialogProps {
  visible: boolean;
  queuedStacks: Stack[];
  fromStackId: string | null;
  getPlayerName: (id: string) => string;
  getPlayerRating: (id: string) => PlayerRating;
  onSelectStack: (stackId: string) => void;
  /** Moves the player into a brand-new stack instead of an existing one. */
  onCreateNewStack: () => void;
  onDismiss: () => void;
}

const TEAM1_COLOR = "#DC2626";
const TEAM2_COLOR = "#1D4ED8";

function formatRating(rating: PlayerRating): string {
  return rating === "NR" ? "NR" : rating.toFixed(1);
}

function PlayerRow({
  playerId,
  accentColor,
  getPlayerName,
  getPlayerRating,
}: {
  playerId?: string;
  accentColor: string;
  getPlayerName: (id: string) => string;
  getPlayerRating: (id: string) => PlayerRating;
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

  const rating = getPlayerRating(playerId);
  return (
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
      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSurface, flex: 1 }}
        numberOfLines={1}
      >
        {getPlayerName(playerId)}
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
    </View>
  );
}

export default function MoveToStackDialog({
  visible,
  queuedStacks,
  fromStackId,
  getPlayerName,
  getPlayerRating,
  onSelectStack,
  onCreateNewStack,
  onDismiss,
}: MoveToStackDialogProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { landscapeColumns } = useSettingsStore();
  const numColumns = isLandscape ? landscapeColumns : 1;

  const cardWidth =
    numColumns === 1 ? "100%" : numColumns === 2 ? "48.5%" : "31.5%";

  const targetStacks = queuedStacks.filter((s) => s.id !== fromStackId);

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={isLandscape ? { alignSelf: "center", width: "80%" } : undefined}
      >
        <Dialog.Title>Move Player to Stack</Dialog.Title>
        <Dialog.ScrollArea style={{ paddingHorizontal: 0, maxHeight: "80%" }}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
            {targetStacks.length === 0 ? (
              <View
                style={{ alignItems: "center", paddingVertical: 24, gap: 8 }}
              >
                <Icon
                  source="layers-off-outline"
                  size={32}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text
                  variant="bodyMedium"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    textAlign: "center",
                  }}
                >
                  No other stacks to move to. Tap "New Stack" below to create
                  one.
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {targetStacks.map((s) => {
                  const index = queuedStacks.indexOf(s) + 1;
                  const total =
                    s.team1.playerIds.length + s.team2.playerIds.length;
                  const isFull = total === 4;

                  return (
                    <Card
                      key={s.id}
                      mode="elevated"
                      onPress={() => onSelectStack(s.id)}
                      style={{
                        width: cardWidth,
                        borderLeftWidth: 4,
                        borderLeftColor: isFull
                          ? theme.colors.primary
                          : theme.colors.surfaceVariant,
                      }}
                    >
                      <View
                        style={{ paddingHorizontal: 16, paddingVertical: 12 }}
                      >
                        {/* Header */}
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginBottom: 12,
                          }}
                        >
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
                          <View
                            style={{
                              flex: 1,
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Text
                              variant="titleSmall"
                              style={{ fontWeight: "700" }}
                            >
                              Stack
                            </Text>
                            {s.type === "winners" && (
                              <Chip
                                compact
                                icon="trophy-outline"
                                style={{ backgroundColor: "#FEF9C3" }}
                                textStyle={{ color: "#854D0E", fontSize: 11 }}
                              >
                                Winners
                              </Chip>
                            )}
                            {s.type === "losers" && (
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
                          {isFull && (
                            <Chip
                              compact
                              icon="swap-horizontal"
                              style={{ backgroundColor: "#FEF9C3" }}
                              textStyle={{ color: "#A16207", fontSize: 11 }}
                            >
                              Swap
                            </Chip>
                          )}
                        </View>

                        {/* Teams */}
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
                            <PlayerRow
                              playerId={s.team1.playerIds[0]}
                              accentColor={TEAM1_COLOR}
                              getPlayerName={getPlayerName}
                              getPlayerRating={getPlayerRating}
                            />
                            <PlayerRow
                              playerId={s.team1.playerIds[1]}
                              accentColor={TEAM1_COLOR}
                              getPlayerName={getPlayerName}
                              getPlayerRating={getPlayerRating}
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
                            <PlayerRow
                              playerId={s.team2.playerIds[0]}
                              accentColor={TEAM2_COLOR}
                              getPlayerName={getPlayerName}
                              getPlayerRating={getPlayerRating}
                            />
                            <PlayerRow
                              playerId={s.team2.playerIds[1]}
                              accentColor={TEAM2_COLOR}
                              getPlayerName={getPlayerName}
                              getPlayerRating={getPlayerRating}
                            />
                          </View>
                        </View>
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onCreateNewStack}>New Stack</Button>
          <Button onPress={onDismiss}>Cancel</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
