import { useResponsiveColumns } from "@/hooks/useResponsiveColumns";
import React from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import {
  Button,
  Dialog,
  Icon,
  Portal,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";

interface PlayerPickerDialogProps {
  visible: boolean;
  candidates: string[];
  getPlayerName: (id: string) => string;
  onSelect: (candidateId: string) => void;
  onDismiss: () => void;
}

export default function PlayerPickerDialog({
  visible,
  candidates,
  getPlayerName,
  onSelect,
  onDismiss,
}: PlayerPickerDialogProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const numColumns = useResponsiveColumns();
  const cardWidth =
    numColumns === 1 ? "100%" : numColumns === 2 ? "48.5%" : "31.5%";

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        testID="player-picker-dialog"
        style={isLandscape ? { alignSelf: "center", width: "50%" } : undefined}
      >
        <Dialog.Title>Select Player to Swap With</Dialog.Title>
        <Dialog.ScrollArea style={{ paddingHorizontal: 0, maxHeight: "80%" }}>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {candidates.map((id) => (
                <TouchableRipple
                  key={id}
                  onPress={() => onSelect(id)}
                  borderless
                  testID={`player-picker-item-${id}`}
                  style={{ borderRadius: 10, width: cardWidth }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      padding: 12,
                      borderRadius: 10,
                      backgroundColor: theme.colors.primaryContainer + "60",
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: theme.colors.primary + "28",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon
                        source="account"
                        size={20}
                        color={theme.colors.primary}
                      />
                    </View>
                    <Text
                      variant="bodyMedium"
                      style={{ fontWeight: "600", flex: 1 }}
                      numberOfLines={1}
                    >
                      {getPlayerName(id)}
                    </Text>
                  </View>
                </TouchableRipple>
              ))}
            </View>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} testID="player-picker-cancel">
            Cancel
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
