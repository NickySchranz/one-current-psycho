import { useState } from "react";
import { ScrollView, View } from "react-native";
import { DEMO_EMAIL, DEMO_PASSWORD, useAppStore } from "@/stores/app-store";
import {
  AppTextInput,
  Button,
  CalmNote,
  Card,
  Field,
  H1,
  Hint,
  T,
  rowStyles,
} from "@/ui/primitives";
import { useTheme } from "@/ui/theme";

/**
 * The signed-out flow: login, register, email verification, and forgot
 * password. Auth is API-first with a local fallback when the server is
 * unreachable; the verify screen shows whenever the store holds a
 * registration that is still waiting on its emailed code.
 */

type AuthScreen = "login" | "register" | "forgot";

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
      <View style={{ alignItems: "center", paddingHorizontal: 16, paddingVertical: 32 }}>
        <View style={{ width: "100%", maxWidth: 420 }}>
          <H1 style={{ textAlign: "center", marginBottom: 20 }}>One Current — Practice</H1>
          {children}
        </View>
      </View>
    </ScrollView>
  );
}

function ErrorHint({ message }: { message: string }) {
  const t = useTheme();
  if (message === "") return null;
  return <Hint style={{ color: t.danger, marginBottom: 8 }}>{message}</Hint>;
}

function LoginScreen({ go }: { go: (s: AuthScreen) => void }) {
  const login = useAppStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    try {
      setError("");
      await login(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The sign-in failed.");
    }
  };

  return (
    <Card>
      <Field label="Email">
        <AppTextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          inputMode="email"
          accessibilityLabel="Email"
          placeholder="you@example.com"
        />
      </Field>
      <Field label="Password">
        <AppTextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          accessibilityLabel="Password"
          placeholder="Your password"
          onSubmitEditing={() => void submit()}
        />
      </Field>
      <ErrorHint message={error} />
      <Button
        variant="primary"
        large
        label="Sign in"
        disabled={email.trim() === "" || password === ""}
        onPress={() => void submit()}
      />
      <View style={[rowStyles.filterRow, { marginTop: 12, justifyContent: "space-between" }]}>
        <Button variant="quiet" label="Forgot password?" onPress={() => go("forgot")} />
        <Button variant="quiet" label="Create an account" onPress={() => go("register")} />
      </View>
      <CalmNote style={{ marginTop: 12 }}>
        <Hint style={{ marginBottom: 0 }}>
          Demo login: {DEMO_EMAIL} · {DEMO_PASSWORD}
        </Hint>
      </CalmNote>
    </Card>
  );
}

function RegisterScreen({ go }: { go: (s: AuthScreen) => void }) {
  const register = useAppStore((s) => s.register);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    try {
      setError("");
      if (password !== confirm) throw new Error("The passwords don't match.");
      await register(name, email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The registration failed.");
    }
  };

  return (
    <Card>
      <Field label="Your name">
        <AppTextInput
          value={name}
          onChangeText={setName}
          autoComplete="name"
          accessibilityLabel="Your name"
          placeholder="Dr. Jane Doe"
        />
      </Field>
      <Field label="Email">
        <AppTextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          inputMode="email"
          accessibilityLabel="Email"
          placeholder="you@example.com"
        />
      </Field>
      <Field label="Password">
        <AppTextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          accessibilityLabel="Password"
          placeholder="At least 8 characters"
        />
      </Field>
      <Field label="Repeat password">
        <AppTextInput
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoComplete="new-password"
          accessibilityLabel="Repeat password"
          placeholder="The same password again"
          onSubmitEditing={() => void submit()}
        />
      </Field>
      <ErrorHint message={error} />
      <Button
        variant="primary"
        large
        label="Create account"
        disabled={name.trim() === "" || email.trim() === "" || password === "" || confirm === ""}
        onPress={() => void submit()}
      />
      <View style={[rowStyles.filterRow, { marginTop: 12 }]}>
        <Button variant="quiet" label="← Back to sign in" onPress={() => go("login")} />
      </View>
    </Card>
  );
}

function VerifyEmailScreen() {
  const pending = useAppStore((s) => s.pendingVerification);
  const verifyEmail = useAppStore((s) => s.verifyEmail);
  const resendVerification = useAppStore((s) => s.resendVerification);
  const cancelVerification = useAppStore((s) => s.cancelVerification);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      setError("");
      setResent(false);
      await verifyEmail(code);
      // The store signs the user in — this screen unmounts by itself.
    } catch (e) {
      setError(e instanceof Error ? e.message : "The verification failed.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError("");
    setResent(false);
    await resendVerification();
    setResent(true);
  };

  return (
    <Card>
      <Hint>
        We sent a code to {pending?.email ?? "your email"}. Paste it here to finish signing
        up.
      </Hint>
      <Field label="Verification code">
        <AppTextInput
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoComplete="one-time-code"
          accessibilityLabel="Verification code"
          placeholder="The code from the email"
          onSubmitEditing={() => void submit()}
        />
      </Field>
      <ErrorHint message={error} />
      {resent && <Hint>A new code is on its way.</Hint>}
      <Button
        variant="primary"
        large
        label={busy ? "One moment…" : "Verify"}
        disabled={busy || code.trim() === ""}
        onPress={() => void submit()}
      />
      <View style={[rowStyles.filterRow, { marginTop: 12, justifyContent: "space-between" }]}>
        <Button variant="quiet" label="Resend the code" onPress={() => void resend()} />
        <Button variant="quiet" label="← Back to sign in" onPress={cancelVerification} />
      </View>
    </Card>
  );
}

function ForgotPasswordScreen({ go }: { go: (s: AuthScreen) => void }) {
  const requestPasswordReset = useAppStore((s) => s.requestPasswordReset);
  const completePasswordReset = useAppStore((s) => s.completePasswordReset);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      setError("");
      await requestPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async () => {
    setBusy(true);
    try {
      setError("");
      await completePasswordReset(token, newPassword);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The reset failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      {done ? (
        <>
          <CalmNote>
            <T>Your password is updated — sign in with it now.</T>
          </CalmNote>
          <View style={[rowStyles.filterRow, { marginTop: 12 }]}>
            <Button variant="quiet" label="← Back to sign in" onPress={() => go("login")} />
          </View>
        </>
      ) : sent ? (
        <>
          <CalmNote>
            <T>
              If an account exists for {email.trim()}, a code is on its way. Paste it here
              with a new password.
            </T>
          </CalmNote>
          <Field label="Code from the email">
            <AppTextInput
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              autoComplete="one-time-code"
              accessibilityLabel="Code from the email"
              placeholder="The code from the email"
            />
          </Field>
          <Field label="New password">
            <AppTextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoComplete="new-password"
              accessibilityLabel="New password"
              placeholder="At least 8 characters"
              onSubmitEditing={() => void submitReset()}
            />
          </Field>
          <ErrorHint message={error} />
          <Button
            variant="primary"
            large
            label={busy ? "One moment…" : "Set the new password"}
            disabled={busy || token.trim() === "" || newPassword === ""}
            onPress={() => void submitReset()}
          />
          <View style={[rowStyles.filterRow, { marginTop: 12 }]}>
            <Button variant="quiet" label="← Back to sign in" onPress={() => go("login")} />
          </View>
        </>
      ) : (
        <>
          <Hint>
            Enter the email you registered with and we'll send you a code to set a new
            password.
          </Hint>
          <Field label="Email">
            <AppTextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              inputMode="email"
              accessibilityLabel="Email"
              placeholder="you@example.com"
              onSubmitEditing={() => void submit()}
            />
          </Field>
          <ErrorHint message={error} />
          <Button
            variant="primary"
            large
            label={busy ? "One moment…" : "Send the code"}
            disabled={busy || email.trim() === ""}
            onPress={() => void submit()}
          />
          <View style={[rowStyles.filterRow, { marginTop: 12 }]}>
            <Button variant="quiet" label="← Back to sign in" onPress={() => go("login")} />
          </View>
        </>
      )}
    </Card>
  );
}

export function AuthFlow() {
  const [screen, setScreen] = useState<AuthScreen>("login");
  const pendingVerification = useAppStore((s) => s.pendingVerification);
  if (pendingVerification) {
    return (
      <AuthShell>
        <VerifyEmailScreen />
      </AuthShell>
    );
  }
  return (
    <AuthShell>
      {screen === "login" && <LoginScreen go={setScreen} />}
      {screen === "register" && <RegisterScreen go={setScreen} />}
      {screen === "forgot" && <ForgotPasswordScreen go={setScreen} />}
    </AuthShell>
  );
}
