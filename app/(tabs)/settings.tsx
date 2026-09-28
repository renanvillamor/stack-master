import ImportReclubSheet, {
  ImportReclubSheetRef,
} from "@/components/player/ImportReclubSheet";
import SessionSyncSection from "@/components/settings/SessionSyncSection";
import TeamManagementModal from "@/components/team/TeamManagementModal";
import { useCourtStore } from "@/store/courtStore";
import { usePlayerStore } from "@/store/playerStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useStackStore } from "@/store/stackStore";
import { useTeamStore } from "@/store/teamStore";
import { useIsSmallDevice } from "@/hooks/useResponsiveColumns";
import React, { useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import {
  Button,
  Card,
  Dialog,
  Divider,
  Icon,
  List,
  Portal,
  SegmentedButtons,
  Switch,
  Text,
  useTheme,
} from "react-native-paper";

/** Vertical hairline between a side-by-side tile pair, or a full-width Divider when they're stacked on a small device. */
function TileDivider({ isSmallDevice }: { isSmallDevice: boolean }) {
  const theme = useTheme();
  return isSmallDevice ? (
    <Divider />
  ) : (
    <View
      style={{
        width: 1,
        backgroundColor: theme.colors.outlineVariant,
        marginVertical: 8,
      }}
    />
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const isSmallDevice = useIsSmallDevice();
  const {
    shufflePlayers,
    toggleShufflePlayers,
    autoStackPlayers,
    toggleAutoStackPlayers,
    landscapeColumns,
    setLandscapeColumns,
    multiGroupStack,
    toggleMultiGroupStack,
  } = useSettingsStore();
  const { clearAll: clearPlayers, addPlayer } = usePlayerStore();
  const { clearAll: clearCourts } = useCourtStore();
  const { clearAll: clearStacks } = useStackStore();
  const { members: teamMembers } = useTeamStore();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [teamManagementVisible, setTeamManagementVisible] = useState(false);
  const importReclubSheetRef = useRef<ImportReclubSheetRef>(null);

  const activeTeamMembers = teamMembers.filter((m) => m.active);

  const handleNewSession = () => {
    clearStacks();
    clearPlayers();
    clearCourts();
    activeTeamMembers.forEach((m) => addPlayer(m.name, m.rating));
    setConfirmVisible(false);
  };

  return (
    <>
      <View className="flex-1 bg-app-bg pt-20">
        <ScrollView className="flex-1">
          <View className="p-4 gap-4">
            {/* Stack Configuration */}
            <Text
              variant="labelLarge"
              style={{
                color: theme.colors.primary,
                paddingHorizontal: 4,
                paddingBottom: 4,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Stack Configuration
            </Text>

            <Card mode="elevated">
              <View style={{ flexDirection: isSmallDevice ? "column" : "row" }}>
                {/* Phones stack the segmented buttons under the label — 3 × Paper's
                    76px button minWidth doesn't fit in half a phone-width tile. */}
                <View
                  style={{
                    width: isSmallDevice ? "100%" : "50%",
                    flexDirection: isSmallDevice ? "column" : "row",
                    alignItems: isSmallDevice ? "stretch" : "center",
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    gap: isSmallDevice ? 12 : 8,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      flex: isSmallDevice ? undefined : 1,
                      minWidth: 0,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <Icon
                      source="view-column-outline"
                      color={theme.colors.primary}
                      size={24}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="bodyLarge" numberOfLines={1}>
                        Landscape Columns
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ color: theme.colors.onSurfaceVariant }}
                      >
                        Cards per row in landscape
                      </Text>
                    </View>
                  </View>
                  <View
                    style={
                      isSmallDevice
                        ? undefined
                        : { flex: 1, minWidth: 0, alignItems: "flex-end" }
                    }
                  >
                    <SegmentedButtons
                      value={String(landscapeColumns)}
                      onValueChange={(v) =>
                        setLandscapeColumns(Number(v) as 1 | 2 | 3)
                      }
                      buttons={[
                        {
                          value: "1",
                          label: "1",
                          testID: "settings-columns-1",
                        },
                        {
                          value: "2",
                          label: "2",
                          testID: "settings-columns-2",
                        },
                        {
                          value: "3",
                          label: "3",
                          testID: "settings-columns-3",
                        },
                      ]}
                    />
                  </View>
                </View>
                <TileDivider isSmallDevice={isSmallDevice} />
                <View
                  style={{
                    width: isSmallDevice ? "100%" : "50%",
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    gap: 8,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      minWidth: 0,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <Icon
                      source="account-group"
                      color={theme.colors.primary}
                      size={24}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="bodyLarge" numberOfLines={1}>
                        Multiple Group Stack
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ color: theme.colors.onSurfaceVariant }}
                      >
                        Split queue by skill group
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={multiGroupStack}
                    onValueChange={toggleMultiGroupStack}
                    color={theme.colors.primary}
                    testID="settings-multigroup-switch"
                  />
                </View>
              </View>
              <Divider />
              <View style={{ flexDirection: isSmallDevice ? "column" : "row" }}>
                <List.Item
                  style={{ flex: 1 }}
                  title="Auto-Stack Players"
                  description="Stack players into win/lose stack on game end"
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon="lightning-bolt"
                      color={theme.colors.primary}
                    />
                  )}
                  right={() => (
                    <Switch
                      value={autoStackPlayers}
                      onValueChange={toggleAutoStackPlayers}
                      color={theme.colors.primary}
                      testID="settings-autostack-switch"
                    />
                  )}
                />
                <TileDivider isSmallDevice={isSmallDevice} />
                <List.Item
                  style={{ flex: 1 }}
                  title="Shuffle Players"
                  description="Split winners & losers onto opposite teams"
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon="shuffle-variant"
                      color={theme.colors.primary}
                    />
                  )}
                  right={() => (
                    <Switch
                      value={shufflePlayers}
                      onValueChange={toggleShufflePlayers}
                      color={theme.colors.primary}
                      testID="settings-shuffle-switch"
                    />
                  )}
                />
              </View>
            </Card>

            {/* Live Sync */}
            <SessionSyncSection />

            {/* Session */}
            <Text
              variant="labelLarge"
              style={{
                color: theme.colors.primary,
                paddingHorizontal: 4,
                paddingTop: 8,
                paddingBottom: 4,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Session
            </Text>

            <Card mode="elevated">
              <View style={{ flexDirection: isSmallDevice ? "column" : "row" }}>
                <List.Item
                  style={{ flex: 1 }}
                  title="Team Management"
                  description="Manage teams and rosters"
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon="account-group-outline"
                      color={theme.colors.primary}
                    />
                  )}
                  onPress={() => setTeamManagementVisible(true)}
                  testID="settings-team-management"
                />
                <TileDivider isSmallDevice={isSmallDevice} />
                <List.Item
                  style={{ flex: 1 }}
                  title="New Session"
                  description="Clear all players, courts and stacks to start fresh"
                  titleStyle={{ color: theme.colors.error }}
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon="restart"
                      color={theme.colors.error}
                    />
                  )}
                  onPress={() => setConfirmVisible(true)}
                  testID="settings-new-session"
                />
              </View>
              <Divider />
              <List.Item
                title="Import from Reclub"
                description="Add players from a pasted Reclub participant list"
                left={(props) => (
                  <List.Icon
                    {...props}
                    icon="content-paste"
                    color={theme.colors.primary}
                  />
                )}
                onPress={() => importReclubSheetRef.current?.present()}
                testID="settings-import-reclub"
              />
            </Card>

            {/* About */}
            <Text
              variant="labelLarge"
              style={{
                color: theme.colors.primary,
                paddingHorizontal: 4,
                paddingTop: 8,
                paddingBottom: 4,
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              About
            </Text>

            <Card mode="elevated">
              <View style={{ flexDirection: isSmallDevice ? "column" : "row" }}>
                <List.Item
                  style={{ flex: 1 }}
                  title="Buy me a Coffee"
                  description="Support the project"
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon="coffee-outline"
                      color={theme.colors.primary}
                    />
                  )}
                />
                <TileDivider isSmallDevice={isSmallDevice} />
                <List.Item
                  style={{ flex: 1 }}
                  title="StackMaster v1.0.0"
                  description="Pickleball stacking made easy"
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon="tennis-ball"
                      color={theme.colors.primary}
                    />
                  )}
                />
              </View>
            </Card>
          </View>
        </ScrollView>
      </View>

      <TeamManagementModal
        visible={teamManagementVisible}
        onDismiss={() => setTeamManagementVisible(false)}
      />

      <ImportReclubSheet ref={importReclubSheetRef} />

      <Portal>
        <Dialog
          visible={confirmVisible}
          onDismiss={() => setConfirmVisible(false)}
          testID="settings-new-session-dialog"
        >
          <Dialog.Icon icon="restart-alert" color={theme.colors.error} />
          <Dialog.Title style={{ textAlign: "center" }}>
            New Session?
          </Dialog.Title>
          <Dialog.Content>
            <Text
              variant="bodyMedium"
              style={{
                color: theme.colors.onSurfaceVariant,
                textAlign: "center",
              }}
            >
              This will permanently delete all players, courts and stacks. This
              action cannot be undone.
              {activeTeamMembers.length > 0
                ? ` ${activeTeamMembers.length} active team member${activeTeamMembers.length !== 1 ? "s" : ""} will be loaded automatically.`
                : ""}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setConfirmVisible(false)}
              testID="settings-new-session-cancel"
            >
              Cancel
            </Button>
            <Button
              textColor={theme.colors.error}
              onPress={handleNewSession}
              testID="settings-new-session-confirm"
            >
              Clear All
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
