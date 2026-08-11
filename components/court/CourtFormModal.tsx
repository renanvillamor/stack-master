import { useCourtStore } from "@/store/courtStore";
import { Court } from "@/types";
import React, { useEffect, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import {
  Button,
  Modal,
  Portal,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

interface CourtFormModalProps {
  visible: boolean;
  court: Court | null;
  onDismiss: () => void;
  defaultName?: string;
}

export default function CourtFormModal({
  visible,
  court,
  onDismiss,
  defaultName = "",
}: CourtFormModalProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { addCourt, editCourt } = useCourtStore();
  const [name, setName] = useState("");

  useEffect(() => {
    setName(court?.name ?? defaultName);
  }, [court, visible]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (court) {
      editCourt(court.id, trimmed);
    } else {
      addCourt(trimmed);
    }
    onDismiss();
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={{
          backgroundColor: theme.colors.surface,
          margin: 24,
          borderRadius: 16,
          padding: 24,
          ...(isLandscape && { alignSelf: "center", width: "50%" }),
        }}
      >
        <Text variant="titleLarge" style={{ marginBottom: 16 }}>
          {court ? "Edit Court" : "Add Court"}
        </Text>

        <TextInput
          label="Court Name"
          value={name}
          onChangeText={setName}
          mode="outlined"
          autoFocus
          style={{ marginBottom: 20 }}
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
        />

        <View className="flex-row justify-end gap-2">
          <Button onPress={onDismiss}>Cancel</Button>
          <Button
            mode="contained"
            onPress={handleSubmit}
            disabled={!name.trim()}
          >
            {court ? "Save" : "Add"}
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}
