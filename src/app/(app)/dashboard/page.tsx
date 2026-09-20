import Link from "next/link";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  const [inProcess, completed, evaluations] = await Promise.all([
    db.evaluation.count({ where: { status: "IN_PROCESS" } }),
    db.evaluation.count({ where: { status: "COMPLETED" } }),
    db.evaluation.findMany({
      where: status === "in_process" ? { status: "IN_PROCESS" } : status === "completed" ? { status: "COMPLETED" } : undefined,
      include: { instrument: true },
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
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Evaluations{status ? ` — ${status.replace("_", " ")}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instrument</TableHead>
                <TableHead>Status</TableHead>
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
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {e.status === "COMPLETED" ? "Completed" : "In process"}
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
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    No evaluations recorded.
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
