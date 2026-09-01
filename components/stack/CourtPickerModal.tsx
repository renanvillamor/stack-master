import { Court } from "@/types";
import React from "react";
import { TouchableOpacity, useWindowDimensions, View } from "react-native";
import {
  Button,
  Dialog,
  Divider,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";

interface CourtPickerModalProps {
  visible: boolean;
  courts: Court[];
  onSelect: (courtId: string) => void;
  onDismiss: () => void;
}

export default function CourtPickerModal({
  visible,
  courts,
  onSelect,
  onDismiss,
}: CourtPickerModalProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        testID="court-picker-dialog"
        style={isLandscape ? { alignSelf: "center", width: "50%" } : undefined}
      >
        <Dialog.Title>Move to Court</Dialog.Title>

        <Dialog.Content style={{ paddingHorizontal: 0 }}>
          {courts.length === 0 ? (
            <Text
              variant="bodyMedium"
              style={{
                color: theme.colors.onSurfaceVariant,
                paddingHorizontal: 24,
              }}
            >
              No courts available. All courts are currently in play.
            </Text>
          ) : (
            courts.map((court, index) => (
              <View key={court.id}>
                {index > 0 && <Divider />}
                <TouchableOpacity
                  onPress={() => {
                    onSelect(court.id);
                    onDismiss();
                  }}
                  testID={`court-picker-item-${court.id}`}
                  style={{ paddingVertical: 14, paddingHorizontal: 24 }}
                >
                  <Text
                    variant="bodyLarge"
                    style={{ color: theme.colors.onSurface }}
                  >
                    {court.name}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </Dialog.Content>

        <Dialog.Actions>
          <Button onPress={onDismiss} testID="court-picker-cancel">
            Cancel
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
