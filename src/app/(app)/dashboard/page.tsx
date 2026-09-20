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
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Dashboard</h1>
      <div className="flex gap-3">
        <StatCard label="In process" value={inProcess} href="/dashboard?status=in_process" />
        <StatCard label="Completed" value={completed} href="/dashboard?status=completed" />
        <StatCard label="History (all)" value={inProcess + completed} href="/dashboard" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evaluations{status ? ` — ${status.replace("_", " ")}` : ""}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instrument</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {evaluations.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    {e.instrument.manufacturer} {e.instrument.model}
                  </TableCell>
                  <TableCell>{e.status}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        e.reviewDecision === "GRANTED" ? "default" : e.reviewDecision === "REFUSED" ? "destructive" : "secondary"
                      }
                    >
                      {e.reviewDecision}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/evaluations/${e.id}/result`} className="underline underline-offset-4">
                      Open
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {evaluations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No evaluations.
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

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href}>
      <Card className="w-40">
        <CardContent className="pt-4">
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
