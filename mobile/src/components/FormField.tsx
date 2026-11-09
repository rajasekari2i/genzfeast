import React from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius } from '../theme/tokens';

/**
 * Labelled text field — specs/017-ui-refresh FR-016, the field treatment the
 * `Login`, `Register`, `UserForm`, `CategoryForm` and `DepartmentForm`
 * artboards all share.
 *
 * A read-only field is distinguished by BORDER STYLE and fill, not colour
 * alone (FR-016) — a dashed outline on the muted fill. Relying on colour
 * would leave the distinction invisible to a colour-blind user, and the
 * app's one permanently read-only field (username on Profile) is exactly
 * where that matters.
 */
export function FormField({
  label,
  hint,
  readOnly = false,
  error,
  ...inputProps
}: TextInputProps & {
  label: string;
  /** Small helper line under the field, e.g. "Min 8 characters." */
  hint?: string;
  readOnly?: boolean;
  error?: string | null;
}) {
  return (
    <View className="gap-xs">
      <Text className="text-label text-text-body">{label}</Text>
      <TextInput
        editable={!readOnly}
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={label}
        style={{
          borderWidth: 1.5,
          borderStyle: readOnly ? 'dashed' : 'solid',
          borderColor: error ? colors.borderDashed : readOnly ? colors.borderDashed : colors.espresso,
          borderRadius: radius.xl,
        }}
        className={`h-field px-md text-body-lg ${
          readOnly ? 'bg-disabled-fill text-text-secondary' : 'bg-surface text-text-primary'
        }`}
        {...inputProps}
      />
      {hint ? <Text className="text-caption text-text-secondary">{hint}</Text> : null}
      {error ? <Text className="text-caption text-red-strong">{error}</Text> : null}
    </View>
  );
}
