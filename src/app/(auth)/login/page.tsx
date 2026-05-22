import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="glass rounded-xl border border-white/10 p-8 text-center text-sm text-muted-foreground">
          Loading...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
