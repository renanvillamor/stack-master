import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
} from "react";
import { TouchableOpacity, View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface OptionItem {
  value: string;
  label: string;
  icon?: string;
}

export interface OptionPickerSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface OptionPickerSheetProps {
  title: string;
  options: OptionItem[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

const OptionPickerSheet = forwardRef<
  OptionPickerSheetRef,
  OptionPickerSheetProps
>(({ title, options, selectedValue, onSelect }, ref) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.outlineVariant }}
    >
      <BottomSheetView style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 4,
            paddingBottom: 12,
          }}
        >
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
            {title}
          </Text>
        </View>
        <Divider />

        {options.map((option) => {
          const isSelected = option.value === selectedValue;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => {
                sheetRef.current?.dismiss();
                onSelect(option.value);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 20,
                paddingVertical: 14,
                gap: 16,
              }}
            >
              {option.icon ? (
                <MaterialCommunityIcons
                  name={option.icon as any}
                  size={22}
                  color={
                    isSelected
                      ? theme.colors.primary
                      : theme.colors.onSurfaceVariant
                  }
                />
              ) : (
                <View style={{ width: 22 }} />
              )}
              <Text
                variant="bodyLarge"
                style={{
                  flex: 1,
                  color: isSelected
                    ? theme.colors.primary
                    : theme.colors.onSurface,
                  fontWeight: isSelected ? "600" : "400",
                }}
              >
                {option.label}
              </Text>
              {isSelected && (
                <MaterialCommunityIcons
                  name="check"
                  size={20}
                  color={theme.colors.primary}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

OptionPickerSheet.displayName = "OptionPickerSheet";
export default OptionPickerSheet;
