import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="font-bold tracking-tight">
            NawiMark
          </Link>
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
            Desk
          </Link>
          <Link href="/instruments" className="text-muted-foreground hover:text-foreground">
            Instruments
          </Link>
        </nav>
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <span>{session.user.email}</span>
          <Badge variant="secondary">{session.user.role}</Badge>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
