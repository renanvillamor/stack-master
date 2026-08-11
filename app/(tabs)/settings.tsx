import TeamManagementModal from "@/components/team/TeamManagementModal";
import { useCourtStore } from "@/store/courtStore";
import { usePlayerStore } from "@/store/playerStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useStackStore } from "@/store/stackStore";
import { useTeamStore } from "@/store/teamStore";
import React, { useState } from "react";
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

export default function SettingsScreen() {
  const theme = useTheme();
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
      <ScrollView className="flex-1 bg-app-bg pt-20">
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
            <View style={{ flexDirection: "row" }}>
              <View
                style={{
                  width: "50%",
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
                <View style={{ flex: 1, minWidth: 0, alignItems: "flex-end" }}>
                  <SegmentedButtons
                    value={String(landscapeColumns)}
                    onValueChange={(v) =>
                      setLandscapeColumns(Number(v) as 1 | 2 | 3)
                    }
                    buttons={[
                      { value: "1", label: "1" },
                      { value: "2", label: "2" },
                      { value: "3", label: "3" },
                    ]}
                  />
                </View>
              </View>
              <View
                style={{
                  width: 1,
                  backgroundColor: theme.colors.outlineVariant,
                  marginVertical: 8,
                }}
              />
              <View
                style={{
                  width: "50%",
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
                />
              </View>
            </View>
            <Divider />
            <View style={{ flexDirection: "row" }}>
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
                  />
                )}
              />
              <View
                style={{
                  width: 1,
                  backgroundColor: theme.colors.outlineVariant,
                  marginVertical: 8,
                }}
              />
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
                  />
                )}
              />
            </View>
          </Card>

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
            <View style={{ flexDirection: "row" }}>
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
              />
              <View
                style={{
                  width: 1,
                  backgroundColor: theme.colors.outlineVariant,
                  marginVertical: 8,
                }}
              />
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
              />
            </View>
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
            <View style={{ flexDirection: "row" }}>
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
              <View
                style={{
                  width: 1,
                  backgroundColor: theme.colors.outlineVariant,
                  marginVertical: 8,
                }}
              />
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

      <TeamManagementModal
        visible={teamManagementVisible}
        onDismiss={() => setTeamManagementVisible(false)}
      />

      <Portal>
        <Dialog
          visible={confirmVisible}
          onDismiss={() => setConfirmVisible(false)}
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
            <Button onPress={() => setConfirmVisible(false)}>Cancel</Button>
            <Button textColor={theme.colors.error} onPress={handleNewSession}>
              Clear All
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
