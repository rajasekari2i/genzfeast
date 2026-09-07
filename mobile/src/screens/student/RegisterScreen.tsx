import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { PrimaryButton } from '../../components/PrimaryButton';
import { CategoryChip } from '../../components/CategoryChip';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { createTypedClient, storeSession } from '../../api/client';
import { getBuildCompanyId } from '../../config/tenant';
import { useAuth } from '../../auth/AuthContext';
import type { paths as RegisterPaths } from '../../api/generated/002-registration-login-jwt-auth';
import type { paths as OptionsPaths } from '../../api/generated/001-company-role-user-setup';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const registerClient = createTypedClient<RegisterPaths>();
const optionsClient = createTypedClient<OptionsPaths>();

type Option = { id: string; name: string };

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
 */
export function RegisterScreen(_props: Props) {
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

  async function handleSubmit() {
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

        {errorMessage ? <Text className="text-body text-red-600">{errorMessage}</Text> : null}
        <PrimaryButton label="Register" onPress={handleSubmit} loading={submitting} disabled={submitting || loadingOptions} />
      </View>
    </Screen>
  );
}
