import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, ScrollView, Text, TextInput, View } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { consumePendingMobileVerificationCode } from '../../notifications/pendingMobileVerificationCode';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { CategoryChip } from '../../components/CategoryChip';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { createTypedClient, storeSession } from '../../api/client';
import { getBuildCompanyId } from '../../config/tenant';
import { getDevicePushToken } from '../../notifications/pushToken';
import { useAuth } from '../../auth/AuthContext';
import type { paths as RegisterPaths } from '../../api/generated/002-registration-login-jwt-auth';
import type { paths as OptionsPaths } from '../../api/generated/001-company-role-user-setup';
import type { paths as MobileVerificationPaths } from '../../api/generated/014-msg91-sms-otp-mobile-verification';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const registerClient = createTypedClient<RegisterPaths>();
const optionsClient = createTypedClient<OptionsPaths>();
const mobileVerificationClient = createTypedClient<MobileVerificationPaths>();

type Option = { id: string; name: string };
type OtpStatus = 'idle' | 'sent' | 'verified';

const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' as const },
  { label: 'Female', value: 'female' as const },
  { label: 'Transgender', value: 'transgender' as const },
];

function toOptions(raw: { id?: string; name?: string }[] | undefined): Option[] {
  return (raw ?? []).filter((o): o is Option => Boolean(o.id && o.name));
}

/**
 * UI Design §4.1. Fields: Name, Username, Password, Category, Department,
 * Email. Category/Department are populated from GET /auth/register/options
 * (a pre-auth lookup added alongside this wiring — see AuthService.
 * getRegistrationOptions). On success, the register response already carries
 * a session (specs/002 FR-001), so this screen calls `useAuth().signIn`
 * directly — no separate login step, and RootNavigator flips to the
 * role-based AppShell on its own, per UI Design's "Register → (auto-login) →
 * Home".
 *
 * specs/014-msg91-sms-otp-mobile-verification: mobile-number verification is
 * folded into this screen (no separate RegisterMobileVerifyScreen route
 * anymore). The primary button is a pure function of `otpStatus` — "Send
 * OTP" → "Verify OTP" → "Register" — with "Resend code" and "Skip for now"
 * as small links alongside it, not folded into the button itself.
 */
export function RegisterScreen() {
  const { signIn } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'transgender' | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mobile-number verification state (specs/014-msg91-sms-otp-mobile-verification).
  const [otpStatus, setOtpStatus] = useState<OtpStatus>('idle');
  // The number `otpStatus` actually applies to — not necessarily `username`,
  // which the student can keep editing.
  const [otpMobileNumber, setOtpMobileNumber] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verificationToken, setVerificationToken] = useState<string | undefined>(undefined);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      const companyId = getBuildCompanyId();
      if (!companyId) {
        if (!cancelled) {
          setErrorMessage('This build is not configured with a Company. Cannot register.');
          setLoadingOptions(false);
        }
        return;
      }

      const { data, error } = await optionsClient.GET('/auth/register/options', {
        params: { query: { company_id: companyId } },
      });

      if (cancelled) return;
      if (error || !data) {
        setErrorMessage('Could not load Category/Department options. Please try again later.');
      } else {
        setCategories(toOptions(data.categories));
        setDepartments(toOptions(data.departments));
      }
      setLoadingOptions(false);
    }

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  // Editing the mobile number after a send/verify invalidates whatever
  // otpStatus applied to the old number — a derived reset, not a locked
  // field, so a stale verification can never ride along with a different
  // number (no "change number" affordance needed).
  useEffect(() => {
    if (otpMobileNumber !== null && otpStatus !== 'idle' && username.trim() !== otpMobileNumber) {
      setOtpStatus('idle');
      setOtpMobileNumber(null);
      setCode('');
      setVerificationToken(undefined);
      setOtpMessage(null);
      setOtpError(null);
    }
  }, [username, otpMobileNumber, otpStatus]);

  // The FCM fallback (auth.service.ts sendMobileVerification, when
  // is_sms=false or MSG91 fails) sends a data-only push. This listener
  // handles the live-foreground case (app active, this screen mounted);
  // the effect below handles the backgrounded/killed-app case (index.ts's
  // background handler + AsyncStorage store), since OEM power management
  // (confirmed on a MIUI device via SmartPower/FcmRetry in logcat) can
  // throttle this app to background moments after the student's own tap,
  // even though it's foregrounded at that exact instant. `mobile_number` is
  // checked against `otpMobileNumber` so a late-arriving code for a number
  // the student has since abandoned/changed never applies to whatever
  // they're currently on.
  useEffect(() => {
    if (otpStatus !== 'sent') return undefined;
    const unsubscribe = messaging().onMessage(async (message) => {
      const payload = message.data as { type?: string; code?: string; mobile_number?: string } | undefined;
      if (payload?.type === 'mobile_verification' && payload.mobile_number === otpMobileNumber && typeof payload.code === 'string') {
        setCode(payload.code);
      }
    });
    return unsubscribe;
  }, [otpStatus, otpMobileNumber]);

  // Backgrounded/killed-app case: consume whatever index.ts's background
  // handler may have stored, both immediately on entering 'sent' (catches a
  // push that arrived in the gap before this effect mounts) and whenever
  // the app returns to 'active' (catches one that arrived while
  // backgrounded/throttled). `consumePendingMobileVerificationCode` already
  // checks the number itself, so a stale entry for an abandoned number is
  // discarded rather than applied.
  useEffect(() => {
    if (otpStatus !== 'sent' || !otpMobileNumber) return undefined;
    const mobileNumber = otpMobileNumber;

    async function tryConsume() {
      const pending = await consumePendingMobileVerificationCode(mobileNumber);
      if (pending) {
        setCode(pending);
      }
    }

    tryConsume();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        tryConsume();
      }
    });
    return () => subscription.remove();
  }, [otpStatus, otpMobileNumber]);

  async function handleSendOtp() {
    setOtpError(null);
    setOtpMessage(null);

    const companyId = getBuildCompanyId();
    if (!companyId) {
      setOtpError('This build is not configured with a Company. Cannot register.');
      return;
    }
    if (!/^\d{10}$/.test(username.trim())) {
      setOtpError('Enter a valid 10-digit mobile number.');
      return;
    }

    setOtpBusy(true);
    try {
      // Best-effort — a null token (no Firebase configured, denied
      // permission, or a simulator) is submitted as undefined; the server
      // simply has no fallback to attempt if SMS then fails.
      const fcmToken = await getDevicePushToken();
      const { data, error } = await mobileVerificationClient.POST('/auth/register/send-verification', {
        body: { company_id: companyId, mobile_number: username.trim(), fcm_token: fcmToken ?? undefined },
      });
      if (error || !data) {
        const message = (error as { message?: string } | undefined)?.message;
        setOtpError(message ?? 'Could not send a code. Please try again.');
        return;
      }
      setOtpMessage(data.message ?? null);
      setOtpMobileNumber(username.trim());
      setCode('');
      setOtpStatus('sent');
    } catch {
      setOtpError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleVerifyOtp() {
    setOtpError(null);

    const companyId = getBuildCompanyId();
    if (!companyId || !otpMobileNumber) return;
    if (!code.trim()) {
      setOtpError('Enter the code sent to your mobile number.');
      return;
    }

    setOtpBusy(true);
    try {
      const { data, error } = await mobileVerificationClient.POST('/auth/register/verify-mobile', {
        body: { company_id: companyId, mobile_number: otpMobileNumber, code: code.trim() },
      });
      if (error || !data) {
        setOtpError('That code is invalid or has expired. Please try again.');
        return;
      }
      setVerificationToken(data.verification_token);
      setOtpStatus('verified');
    } catch {
      setOtpError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setOtpBusy(false);
    }
  }

  async function submitRegistration(tokenToUse: string | undefined) {
    setErrorMessage(null);

    const companyId = getBuildCompanyId();
    if (!companyId) {
      setErrorMessage('This build is not configured with a Company. Cannot register.');
      return;
    }
    if (!name.trim() || !/^\d{10}$/.test(username.trim()) || password.length < 8 || !email.trim()) {
      setErrorMessage('Fill in Name, a 10-digit Username, a Password (min 8 characters), and Email.');
      return;
    }
    if (!gender) {
      setErrorMessage('Please select a Gender.');
      return;
    }
    if (!categoryId) {
      setErrorMessage('Please select a Category.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await registerClient.POST('/auth/register', {
        body: {
          name: name.trim(),
          username: username.trim(),
          password,
          email: email.trim(),
          gender,
          category_id: categoryId,
          department_id: departmentId ?? undefined,
          company_id: companyId,
          mobile_verification_token: tokenToUse,
        },
      });

      if (error || !data) {
        // contracts/openapi.yaml's ValidationError/DuplicateUsername
        // responses don't declare a body schema (unlike ErrorResponse
        // elsewhere), even though the server's global exception filter
        // always returns { message } — read it defensively.
        const message = (error as { message?: string } | undefined)?.message;
        setErrorMessage(message ?? 'Registration failed. Please check your details and try again.');
        return;
      }

      await storeSession(data);
      if (data.user) {
        signIn(data.user);
      }
    } catch {
      setErrorMessage('Could not reach the server. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const primaryButton =
    otpStatus === 'idle'
      ? { label: 'Send OTP', onPress: handleSendOtp, loading: otpBusy, disabled: otpBusy }
      : otpStatus === 'sent'
        ? { label: 'Verify OTP', onPress: handleVerifyOtp, loading: otpBusy, disabled: otpBusy }
        : {
            label: 'Register',
            onPress: () => submitRegistration(verificationToken),
            loading: submitting,
            disabled: submitting || loadingOptions,
          };

  return (
    <Screen title="Register" specRef="UI Design §4.1">
      <View className="gap-3">
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Name"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Username (10-digit mobile number)"
          keyboardType="phone-pad"
          autoCapitalize="none"
          maxLength={10}
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Password (min 8 characters)"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          className="border border-border rounded-lg px-3 py-2 text-text-primary"
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <View className="gap-1">
          <Text className="text-body-bold text-text-primary">Gender</Text>
          <View className="flex-row flex-wrap">
            {GENDER_OPTIONS.map((option) => (
              <CategoryChip
                key={option.value}
                label={option.label}
                selected={gender === option.value}
                onPress={() => setGender(option.value)}
              />
            ))}
          </View>
        </View>

        {loadingOptions ? (
          <ActivityIndicator />
        ) : (
          <>
            <Text className="text-body-bold text-text-primary">Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row">
                {categories.map((c) => (
                  <CategoryChip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
                ))}
              </View>
            </ScrollView>

            {departments.length > 0 ? (
              <>
                <Text className="text-body-bold text-text-primary">Department (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row">
                    {departments.map((d) => (
                      <CategoryChip
                        key={d.id}
                        label={d.name}
                        selected={departmentId === d.id}
                        onPress={() => setDepartmentId(departmentId === d.id ? null : d.id)}
                      />
                    ))}
                  </View>
                </ScrollView>
              </>
            ) : null}
          </>
        )}

        {otpStatus === 'sent' ? (
          <TextInput
            className="border border-border rounded-lg px-3 py-2 text-text-primary"
            placeholder="6-digit code"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />
        ) : null}
        {otpStatus === 'verified' ? (
          <Text className="text-body text-text-secondary">Mobile number verified.</Text>
        ) : null}
        {otpMessage ? <Text className="text-body text-text-secondary">{otpMessage}</Text> : null}
        {otpError ? <Text className="text-body text-red-600">{otpError}</Text> : null}

        {errorMessage ? <Text className="text-body text-red-600">{errorMessage}</Text> : null}
        <PrimaryButton
          label={primaryButton.label}
          onPress={primaryButton.onPress}
          loading={primaryButton.loading}
          disabled={primaryButton.disabled}
        />
        {otpStatus === 'sent' ? (
          <Text className="text-center text-body text-text-secondary" onPress={otpBusy ? undefined : handleSendOtp}>
            Resend code
          </Text>
        ) : null}
        {otpStatus !== 'verified' ? (
          <Text
            className="text-center text-body text-text-secondary"
            onPress={submitting ? undefined : () => submitRegistration(undefined)}
          >
            Skip for now
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
