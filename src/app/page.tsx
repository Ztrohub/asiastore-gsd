import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { decodeSession, SESSION_COOKIE_NAME } from "@/lib/auth/server-session";

export default async function Home() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? decodeSession(token) : null;

  if (session) {
    redirect("/app");
  }

  return <LoginForm />;
}
