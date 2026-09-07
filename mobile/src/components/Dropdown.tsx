import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { colors } from '../theme/tokens';

export interface DropdownOption<T extends string> {
  label: string;
  value: T;
}

/**
 * A real dropdown (tap the field, pick from a list) built on Modal +
 * Pressable — React Native core only. Deliberately not
 * `@react-native-picker/picker`: that package ships native code, which
 * would require another full native rebuild to link (see the app-icon
 * native-rebuild episode this session already went through) for what a
 * pure-JS modal sheet already does just as well.
 */
export function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select...',
}: {
  label?: string;
  value: T | undefined;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View className="gap-1">
      {label ? <Text className="text-caption text-text-secondary">{label}</Text> : null}
      <Pressable
        className="border border-border rounded-lg px-3 py-2 flex-row items-center justify-between"
        onPress={() => setOpen(true)}
      >
        <Text className={selected ? 'text-body text-text-primary' : 'text-body text-text-secondary'}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text className="text-body text-text-secondary">▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/40 justify-center px-8" onPress={() => setOpen(false)}>
          <View className="bg-surface rounded-lg overflow-hidden">
            {options.map((option, index) => (
              <Pressable
                key={option.value}
                className={`px-4 py-3 ${index > 0 ? 'border-t border-border' : ''}`}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <Text
                  style={{ color: option.value === value ? colors.primary : undefined }}
                  className={option.value === value ? 'text-body-bold' : 'text-body text-text-primary'}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
