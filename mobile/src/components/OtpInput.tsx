import React, { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { colors } from '../theme/tokens';

const LENGTH = 6;

/**
 * Pickup-code entry — specs/017-ui-refresh FR-018.
 *
 * Six segmented boxes. On an incorrect code the boxes CLEAR so the operator
 * can retry immediately, which is what the Fulfilment artboard specifies
 * ("Wrong code? The boxes clear so you can retry"). Clearing is driven by the
 * `error` prop flipping true rather than by the component judging the code
 * itself — only the server knows whether a code is right, and a mismatch
 * must leave the order completely untouched.
 *
 * Also used by forgot-password verification, which has no artboard and
 * borrows this pattern (FR-029).
 */
export function OtpInput({
  onComplete,
  error = false,
  editable = true,
  accessibilityLabel = 'Enter the 6-digit code',
}: {
  onComplete: (code: string) => void;
  /** Flip true when the submitted code was rejected — the boxes clear. */
  error?: boolean;
  editable?: boolean;
  accessibilityLabel?: string;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<TextInput>(null);
  const wasError = useRef(error);

  useEffect(() => {
    // Clear only on the rising edge, so a persistent error banner doesn't
    // wipe what the operator is currently retyping.
    if (error && !wasError.current) {
      setValue('');
      inputRef.current?.focus();
    }
    wasError.current = error;
  }, [error]);

  const handleChange = (next: string) => {
    const digits = next.replace(/\D/g, '').slice(0, LENGTH);
    setValue(digits);
    if (digits.length === LENGTH) onComplete(digits);
  };

  const cells = Array.from({ length: LENGTH }, (_, i) => value[i] ?? '');

  return (
    <View>
      {/* One real input holds the value and the keyboard; the cells below are
          its visual presentation. Six separate inputs would fight over focus
          and break paste. */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={LENGTH}
        editable={editable}
        accessibilityLabel={accessibilityLabel}
        className="absolute w-full h-full opacity-0"
        style={{ zIndex: 1 }}
      />
      <View className="flex-row gap-xs" pointerEvents="none">
        {cells.map((d, i) => {
          const focused = i === value.length && editable;
          return (
            <View
              key={i}
              style={{
                borderColor: focused ? colors.espresso : colors.borderDashed,
                borderWidth: 1.5,
              }}
              className={`flex-1 h-field rounded-sm items-center justify-center ${
                d ? 'bg-surface' : 'bg-disabled-fill'
              }`}
            >
              <TextInput
                value={d}
                editable={false}
                className="text-title text-espresso text-center"
                pointerEvents="none"
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}
