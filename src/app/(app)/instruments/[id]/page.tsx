import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createEvaluationAction } from "../../evaluations/actions";

export default async function InstrumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const instrument = await db.instrument.findUnique({
    where: { id },
    include: { evaluations: { orderBy: { id: "desc" } } },
  });
  if (!instrument) notFound();

  const isOwner = session?.user.role === "TESTER" && session.user.id === instrument.createdById;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Link href="/instruments" className="text-xs text-muted-foreground hover:text-foreground">
              &larr; Instruments
            </Link>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {instrument.manufacturer} {instrument.model}
          </h1>
        </div>
        {isOwner ? (
          <form action={createEvaluationAction.bind(null, instrument.id)}>
            <Button type="submit">New evaluation</Button>
          </form>
        ) : null}
      </div>

      <Card className="rounded-xs border border-border">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Technical specifications & parameters
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-3 flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xs border border-border bg-card/60 p-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Class
              </span>
              <span className="text-base font-bold font-mono text-foreground">{instrument.class}</span>
            </div>
            <div className="rounded-2xs border border-border bg-card/60 p-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Max Capacity
              </span>
              <span className="text-base font-bold font-mono tabular-nums text-foreground">{instrument.maxG} g</span>
            </div>
            <div className="rounded-2xs border border-border bg-card/60 p-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Verification interval (e)
              </span>
              <span className="text-base font-bold font-mono tabular-nums text-foreground">{instrument.eG} g</span>
            </div>
            <div className="rounded-2xs border border-border bg-card/60 p-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Interval count (n = Max/e)
              </span>
              <span className="text-base font-bold font-mono tabular-nums text-foreground">{instrument.n}</span>
            </div>
          </div>

          {instrument.model === "ILLEGAL-n" ? (
            <div className="cannot-card">
              <h2 className="text-sm font-bold text-destructive mb-1">Illegal parameter combination (Table 3)</h2>
              <p className="text-xs text-destructive/90 leading-relaxed">
                This seeded demo instrument is illegal on Table 3 (class III n=30000). Starting an
                evaluation marks cannot-compute and will not produce a report. The create-instrument
                form still rejects this combination.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-xs border border-border">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Evaluation history
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead className="text-right pr-4">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instrument.evaluations.map((e) => (
                <TableRow key={e.id} className="group">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {e.status === "COMPLETED" ? "Completed" : "In process"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        e.reviewDecision === "GRANTED"
                          ? "default"
                          : e.reviewDecision === "REFUSED"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {e.reviewDecision === "GRANTED"
                        ? "Granted"
                        : e.reviewDecision === "REFUSED"
                          ? "Refused"
                          : "Not reviewed"}
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
              {instrument.evaluations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                    No evaluations yet.
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
