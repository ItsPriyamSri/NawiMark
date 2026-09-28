import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { shortVerdict, type Verdict } from "@/lib/reports/explainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; q?: string | string[] }>;
}) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : undefined;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) || undefined : undefined;

  // Testers see their own instruments' evaluations; reviewers see the whole desk.
  const session = await auth();
  const mine = session?.user.role === "TESTER" ? { createdById: session.user.id } : {};
  const search = q
    ? {
        OR: [
          { manufacturer: { contains: q, mode: "insensitive" as const } },
          { model: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [inProcess, completed, evaluations] = await Promise.all([
    db.evaluation.count({ where: { status: "IN_PROCESS", instrument: mine } }),
    db.evaluation.count({ where: { status: "COMPLETED", instrument: mine } }),
    db.evaluation.findMany({
      where: {
        ...(status === "in_process" ? { status: "IN_PROCESS" as const } : status === "completed" ? { status: "COMPLETED" as const } : {}),
        instrument: { ...mine, ...search },
      },
      include: { instrument: true, procedures: { select: { key: true, status: true } } },
      orderBy: { id: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Desk</h1>
        <p className="text-xs text-muted-foreground">Type-approval evaluation bench & record ledger</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        <StatCard label="In process" value={inProcess} href="/dashboard?status=in_process" active={status === "in_process"} />
        <StatCard label="Completed" value={completed} href="/dashboard?status=completed" active={status === "completed"} />
        <StatCard label="History (all)" value={inProcess + completed} href="/dashboard" active={!status} />
      </div>

      <Card className="rounded-xs border border-border">
        <CardHeader className="py-3 px-4 flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Evaluations{status ? ` — ${status.replace("_", " ")}` : ""}
          </CardTitle>
          <form action="/dashboard" className="flex gap-2">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <Input type="search" name="q" defaultValue={q ?? ""} placeholder="Manufacturer or model" aria-label="Search evaluations" className="h-8 w-48 text-xs" />
            <Button type="submit" variant="outline" size="sm">
              Search
            </Button>
          </form>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instrument</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead className="text-right pr-4">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evaluations.map((e) => (
                <TableRow key={e.id} className="group">
                  <TableCell className="font-medium text-foreground">
                    <span className="font-bold">{e.instrument.manufacturer}</span>{" "}
                    <span className="font-mono text-xs text-muted-foreground">{e.instrument.model}</span>
                    <span className="block font-mono text-[10px] text-muted-foreground">
                      {e.id.slice(-8)} · {e.packId}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {e.status === "COMPLETED" ? "Completed" : "In process"}
                  </TableCell>
                  <TableCell>
                    <VerdictBadge verdict={shortVerdict(e.procedures)} />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        e.reviewDecision === "GRANTED" ? "default" : e.reviewDecision === "REFUSED" ? "destructive" : "secondary"
                      }
                    >
                      {e.reviewDecision === "GRANTED" ? "Granted" : e.reviewDecision === "REFUSED" ? "Refused" : "Not reviewed"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <Link
                      href={`/evaluations/${e.id}/result`}
                      className="font-medium text-xs text-primary underline underline-offset-4 decoration-border group-hover:decoration-primary transition-colors"
                    >
                      Open &rarr;
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {evaluations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    {q ? `No evaluations match “${q}”.` : "No evaluations recorded."}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const variant = verdict === "PASS" ? "success" : verdict === "INCOMPLETE" ? "outline" : "destructive";
  return <Badge variant={variant}>{verdict}</Badge>;
}

function StatCard({ label, value, href, active }: { label: string; value: number; href: string; active?: boolean }) {
  return (
    <Link href={href} className="flex-1 sm:flex-initial">
      <Card className="stat-tile w-full sm:w-40 rounded-xs cursor-pointer p-0" data-active={active ? "true" : undefined}>
        <CardContent className="p-3.5 flex flex-col gap-0.5">
          <span className="text-2xl font-bold tabular-nums text-foreground tracking-tight">{value}</span>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        </CardContent>
      </Card>
    </Link>
  );
}
