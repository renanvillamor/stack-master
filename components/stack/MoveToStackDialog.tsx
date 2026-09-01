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
  TouchableRipple,
  useTheme,
} from "react-native-paper";

interface MoveToStackDialogProps {
  visible: boolean;
  queuedStacks: Stack[];
  fromStackId: string | null;
  /** Name of the player being moved, shown in the dialog title for context. */
  movingPlayerName?: string;
  /**
   * True when the player being moved is bringing a locked partner along
   * (see stackStore.movePlayerBetweenStacks) — the store seats the pair as
   * a unit and aborts if there's no room, so target selection stays a
   * whole-card tap rather than picking an individual player to swap with.
   */
  pairedMove?: boolean;
  getPlayerName: (id: string) => string;
  getPlayerRating: (id: string) => PlayerRating;
  isPlayerLocked?: (id: string) => boolean;
  /** Whole-card tap: moves the player directly into a stack with room (or a paired move). */
  onSelectStack: (stackId: string) => void;
  /** Tapping a specific occupied, unlocked player in a full stack: swap the moving player in for that player. */
  onSelectSwapTarget: (stackId: string, targetPlayerId: string) => void;
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
  isLocked,
  onPress,
  testID,
}: {
  playerId?: string;
  accentColor: string;
  getPlayerName: (id: string) => string;
  getPlayerRating: (id: string) => PlayerRating;
  isLocked?: boolean;
  /** Present only when this row is a valid swap target (occupied, unlocked, target stack full). */
  onPress?: () => void;
  testID?: string;
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
  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 2,
        paddingHorizontal: 2,
        opacity: isLocked && !onPress ? 0.5 : 1,
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
      {isLocked ? (
        <Icon source="lock" size={13} color={theme.colors.onSurfaceVariant} />
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <TouchableRipple
      onPress={onPress}
      borderless
      style={{ borderRadius: 8 }}
      rippleColor={accentColor + "30"}
      testID={testID}
    >
      {content}
    </TouchableRipple>
  );
}

export default function MoveToStackDialog({
  visible,
  queuedStacks,
  fromStackId,
  movingPlayerName,
  pairedMove = false,
  getPlayerName,
  getPlayerRating,
  isPlayerLocked,
  onSelectStack,
  onSelectSwapTarget,
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
        testID="move-to-stack-dialog"
        style={isLandscape ? { alignSelf: "center", width: "80%" } : undefined}
      >
        <Dialog.Title>
          {movingPlayerName ? `Move ${movingPlayerName} to Stack` : "Move Player to Stack"}
        </Dialog.Title>
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
                  // A full, non-paired move has no open seat to land in — the
                  // user must tap the specific player to swap with instead of
                  // the whole card.
                  const requiresSwapPick = isFull && !pairedMove;
                  const swapRowProps = (playerId?: string) =>
                    requiresSwapPick && playerId && !isPlayerLocked?.(playerId)
                      ? {
                          onPress: () => onSelectSwapTarget(s.id, playerId),
                          testID: `move-to-stack-player-${playerId}`,
                        }
                      : {};

                  return (
                    <Card
                      key={s.id}
                      mode="elevated"
                      onPress={requiresSwapPick ? undefined : () => onSelectStack(s.id)}
                      testID={`move-to-stack-item-${s.id}`}
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

                        {requiresSwapPick && (
                          <Text
                            variant="labelSmall"
                            style={{
                              color: theme.colors.onSurfaceVariant,
                              marginBottom: 8,
                              fontStyle: "italic",
                            }}
                          >
                            Tap a player below to swap places
                          </Text>
                        )}

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
                              isLocked={
                                s.team1.playerIds[0]
                                  ? isPlayerLocked?.(s.team1.playerIds[0])
                                  : false
                              }
                              {...swapRowProps(s.team1.playerIds[0])}
                            />
                            <PlayerRow
                              playerId={s.team1.playerIds[1]}
                              accentColor={TEAM1_COLOR}
                              getPlayerName={getPlayerName}
                              getPlayerRating={getPlayerRating}
                              isLocked={
                                s.team1.playerIds[1]
                                  ? isPlayerLocked?.(s.team1.playerIds[1])
                                  : false
                              }
                              {...swapRowProps(s.team1.playerIds[1])}
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
                              isLocked={
                                s.team2.playerIds[0]
                                  ? isPlayerLocked?.(s.team2.playerIds[0])
                                  : false
                              }
                              {...swapRowProps(s.team2.playerIds[0])}
                            />
                            <PlayerRow
                              playerId={s.team2.playerIds[1]}
                              accentColor={TEAM2_COLOR}
                              getPlayerName={getPlayerName}
                              getPlayerRating={getPlayerRating}
                              isLocked={
                                s.team2.playerIds[1]
                                  ? isPlayerLocked?.(s.team2.playerIds[1])
                                  : false
                              }
                              {...swapRowProps(s.team2.playerIds[1])}
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
          <Button onPress={onCreateNewStack} testID="move-to-stack-new">New Stack</Button>
          <Button onPress={onDismiss} testID="move-to-stack-cancel">Cancel</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
