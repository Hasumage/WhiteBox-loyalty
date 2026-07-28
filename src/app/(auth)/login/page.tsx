import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams?: Promise<{
    deleted?: string;
    frozen?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <LoginForm
      deleted={params?.deleted === "1"}
      frozen={params?.frozen === "1"}
      requestedNext={params?.next ?? null}
    />
  );
}
