import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="card login-card">
      <h1>Sign in</h1>
      <p className="lede">Admin for this analytics service. The tracking script does not require a login.</p>
      <LoginForm />
    </main>
  );
}
