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
      <header className="desk-bar px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-y-2 gap-x-4">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="nav-ink text-base font-bold tracking-tight text-primary">
              NawiMark
            </Link>
            <div className="h-4 w-px bg-border/80" aria-hidden="true" />
            <Link href="/dashboard" className="nav-ink text-muted-foreground hover:text-foreground">
              Desk
            </Link>
            <Link href="/instruments" className="nav-ink text-muted-foreground hover:text-foreground">
              Instruments
            </Link>
          </nav>
          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-muted-foreground">
            <span className="max-w-44 truncate font-mono text-xs">{session.user.email}</span>
            <Badge variant="secondary" className="text-[10px] sm:text-xs">
              {session.user.role}
            </Badge>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button type="submit" variant="ghost" size="xs" className="text-muted-foreground hover:text-foreground">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="desk-main mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6 md:p-8">{children}</main>
    </div>
  );
}
