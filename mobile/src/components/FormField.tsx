import React from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius } from '../theme/tokens';

/**
 * Labelled text field — specs/017-ui-refresh FR-016.
 *
 * The two artboard families draw this field DIFFERENTLY, so `tone` selects
 * between them rather than one being approximated by the other:
 *   student  espresso 1.5px rule at radius 16 (Login, Register)
 *   admin    #DDD6CC 1.5px rule at radius 14 on a white section card
 *            (Add/edit user — and the product form, which has no artboard of
 *            its own and follows it)
 *   sheet    a 2px NAVY rule at radius 16, 54px tall with 16px text — the
 *            single emphasised field in the Edit category / Add department
 *            bottom sheets, where there is nothing else competing for focus
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
  tone = 'student',
  ...inputProps
}: TextInputProps & {
  label: string;
  /** Small helper line under the field, e.g. "Min 8 characters." */
  hint?: string;
  readOnly?: boolean;
  error?: string | null;
  /** Which artboard family this field belongs to — see the note above. */
  tone?: 'student' | 'admin' | 'sheet';
}) {
  return (
    <View className="gap-xs">
      <Text className="text-label text-text-body">{label}</Text>
      <TextInput
        editable={!readOnly}
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={label}
        style={{
          borderStyle: readOnly ? 'dashed' : 'solid',
          borderColor:
            error || readOnly
              ? colors.borderDashed
              : tone === 'admin'
                ? colors.borderChip
                : tone === 'sheet'
                  ? colors.primaryVariant
                  : colors.espresso,
          borderWidth: tone === 'sheet' ? 2 : 1.5,
          borderRadius: tone === 'admin' ? radius.lg : radius.xl,
          // 54px on BOTH the student artboards (Login, Register) and the
          // sheets — size.field (48) is the admin forms' height, not these.
          ...(tone === 'sheet' || tone === 'student' ? { height: 54, paddingHorizontal: 18 } : null),
        }}
        className={`${tone === 'admin' ? 'h-field px-md' : ''} text-body-lg ${
          readOnly ? 'bg-disabled-fill text-text-secondary' : 'bg-surface text-text-primary'
        }`}
        {...inputProps}
      />
      {hint ? <Text className="text-caption text-text-secondary">{hint}</Text> : null}
      {error ? <Text className="text-caption text-red-strong">{error}</Text> : null}
    </View>
  );
}
