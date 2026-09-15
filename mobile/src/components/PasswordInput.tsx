import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

/**
 * A password TextInput with a "Show"/"Hide" toggle overlaid on the right.
 * A themed text label, not a bare eye emoji — matches RowActionButton's own
 * convention (see its doc comment): an emoji renders in the OS's own
 * full-color style regardless of this app's palette.
 */
export function PasswordInput({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View className="justify-center">
      <TextInput
        className="border border-border rounded-lg px-3 py-2 pr-14 text-text-primary"
        placeholder={placeholder}
        secureTextEntry={!visible}
        value={value}
        onChangeText={onChangeText}
      />
      <Pressable
        onPress={() => setVisible((current) => !current)}
        hitSlop={8}
        className="absolute right-3"
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      >
        <Text className="text-caption font-semibold text-primary">{visible ? 'Hide' : 'Show'}</Text>
      </Pressable>
    </View>
  );
}
