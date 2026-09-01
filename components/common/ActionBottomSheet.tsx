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
import { Divider, Switch, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface ActionItem {
  label: string;
  icon: string;
  onPress?: () => void;
  destructive?: boolean;
  type?: "button" | "switch";
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
}

export interface ActionBottomSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface ActionBottomSheetProps {
  actions: ActionItem[];
  title?: string;
}

const ActionBottomSheet = forwardRef<
  ActionBottomSheetRef,
  ActionBottomSheetProps
>(({ actions, title }, ref) => {
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
        {title ? (
          <>
            <View
              style={{
                paddingHorizontal: 20,
                paddingTop: 4,
                paddingBottom: 12,
              }}
            >
              <Text
                variant="titleMedium"
                style={{ color: theme.colors.onSurface }}
              >
                {title}
              </Text>
            </View>
            <Divider />
          </>
        ) : null}

        {actions.map((item, index) => (
          <TouchableOpacity
            key={index}
            testID={item.testID}
            onPress={() => {
              if (item.disabled) return;
              if (item.type === "switch") {
                item.onValueChange?.(!item.value);
                return;
              }
              sheetRef.current?.dismiss();
              item.onPress?.();
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingVertical: 14,
              gap: 16,
              opacity: item.disabled ? 0.5 : 1,
            }}
            disabled={item.disabled}
          >
            <MaterialCommunityIcons
              name={item.icon as any}
              size={22}
              color={
                item.destructive ? theme.colors.error : theme.colors.onSurface
              }
            />
            <Text
              variant="bodyLarge"
              style={{
                flex: 1,
                color: item.destructive
                  ? theme.colors.error
                  : theme.colors.onSurface,
              }}
            >
              {item.label}
            </Text>
            {item.type === "switch" ? (
              <Switch
                value={item.value ?? false}
                onValueChange={(value) => item.onValueChange?.(value)}
                disabled={item.disabled}
                color={theme.colors.primary}
              />
            ) : null}
          </TouchableOpacity>
        ))}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

ActionBottomSheet.displayName = "ActionBottomSheet";

export default ActionBottomSheet;
