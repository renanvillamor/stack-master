import ActionBottomSheet, {
  ActionBottomSheetRef,
  ActionItem,
} from "@/components/common/ActionBottomSheet";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import TeamMemberFormModal from "@/components/team/TeamMemberFormModal";
import { useTeamStore } from "@/store/teamStore";
import { TeamMember } from "@/types";
import React, { useRef, useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import {
  Divider,
  Icon,
  IconButton,
  Modal,
  Portal,
  Switch,
  Text,
  TextInput,
  TouchableRipple,
  useTheme,
} from "react-native-paper";

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export default function TeamManagementModal({ visible, onDismiss }: Props) {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const { teamName, members, setTeamName, removeMember, toggleMemberActive } =
    useTeamStore();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [formVisible, setFormVisible] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const sheetRef = useRef<ActionBottomSheetRef>(null);

  const selectedMember = members.find((m) => m.id === selectedMemberId) ?? null;
  const activeCount = members.filter((m) => m.active).length;

  const startEditName = () => {
    setNameInput(teamName);
    setEditingName(true);
  };

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed) setTeamName(trimmed);
    setEditingName(false);
  };

  const handleMemberPress = (member: TeamMember) => {
    setSelectedMemberId(member.id);
    sheetRef.current?.present();
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      removeMember(deleteTarget);
      setDeleteTarget(null);
    }
  };

  const memberActions: ActionItem[] = [
    {
      label: "Edit",
      icon: "pencil-outline",
      onPress: () => {
        setEditingMember(selectedMember);
        setFormVisible(true);
      },
    },
    {
      label: "Delete",
      icon: "delete-outline",
      destructive: true,
      onPress: () => setDeleteTarget(selectedMember?.id ?? null),
    },
  ];

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={{
          backgroundColor: theme.colors.surface,
          margin: 24,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingLeft: editingName ? 8 : 20,
            paddingRight: 4,
            paddingVertical: 4,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.outlineVariant,
          }}
        >
          {editingName ? (
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              mode="flat"
              autoFocus
              dense
              onBlur={handleSaveName}
              onSubmitEditing={handleSaveName}
              returnKeyType="done"
              style={{ flex: 1, backgroundColor: "transparent" }}
            />
          ) : (
            <TouchableRipple
              onPress={startEditName}
              borderless
              style={{ flex: 1, borderRadius: 4, paddingVertical: 6 }}
            >
              <Text variant="titleLarge">{teamName}</Text>
            </TouchableRipple>
          )}
          <IconButton
            icon="plus"
            size={22}
            onPress={() => {
              setEditingMember(null);
              setFormVisible(true);
            }}
          />
          <IconButton icon="close" size={22} onPress={onDismiss} />
        </View>

        <Text
          variant="bodySmall"
          style={{
            color: theme.colors.onSurfaceVariant,
            paddingHorizontal: 20,
            paddingVertical: 8,
          }}
        >
          {members.length} member{members.length !== 1 ? "s" : ""} · {activeCount} active
        </Text>

        <Divider />

        {/* Member list */}
        <ScrollView style={{ maxHeight: height * 0.5 }}>
          {members.length === 0 ? (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 40,
                gap: 6,
              }}
            >
              <Icon
                source="account-group-outline"
                size={40}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                No members yet — tap + to add
              </Text>
            </View>
          ) : (
            members.map((item) => (
              <React.Fragment key={item.id}>
                <TouchableRipple
                  onPress={() => handleMemberPress(item)}
                  style={{ opacity: item.active ? 1 : 0.45 }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 16,
                      paddingVertical: 6,
                      gap: 16,
                    }}
                  >
                    <Icon
                      source="account-circle-outline"
                      size={24}
                      color={item.active ? theme.colors.primary : theme.colors.onSurfaceVariant}
                    />
                    <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 6 }}>
                      <Text variant="bodyLarge" numberOfLines={1} style={{ flexShrink: 1 }}>
                        {item.name}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <Icon source="medal-outline" size={13} color={theme.colors.onSurfaceVariant} />
                        <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 11, fontWeight: "700" }}>
                          {item.rating === "NR" ? "NR" : item.rating.toFixed(1)}
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={item.active}
                      onValueChange={() => toggleMemberActive(item.id)}
                      color={theme.colors.primary}
                    />
                  </View>
                </TouchableRipple>
                <Divider />
              </React.Fragment>
            ))
          )}
        </ScrollView>

        <ActionBottomSheet
          ref={sheetRef}
          title={selectedMember?.name}
          actions={memberActions}
        />

        <ConfirmDialog
          visible={!!deleteTarget}
          title="Remove Member"
          message="Remove this player from the team roster?"
          onConfirm={confirmDelete}
          onDismiss={() => setDeleteTarget(null)}
        />

        <TeamMemberFormModal
          visible={formVisible}
          member={editingMember}
          onDismiss={() => setFormVisible(false)}
        />
      </Modal>
    </Portal>
  );
}
