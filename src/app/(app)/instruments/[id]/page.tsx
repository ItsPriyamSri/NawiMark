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
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {instrument.manufacturer} {instrument.model}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
          <p>Class {instrument.class}</p>
          <p>Max {instrument.maxG} g, e {instrument.eG} g, n = {instrument.n}</p>
          {instrument.model === "ILLEGAL-n" ? (
            <p className="text-destructive">
              This fixture is illegal on Table 3 (class III n=30000). Starting an evaluation marks
              cannot-compute and will not produce a report. The create-instrument form still rejects
              this combination.
            </p>
          ) : null}
          {isOwner ? (
            <form action={createEvaluationAction.bind(null, instrument.id)} className="mt-2">
              <Button type="submit">New evaluation</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evaluations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {instrument.evaluations.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.status}</TableCell>
                  <TableCell>
                    <Badge variant={e.reviewDecision === "GRANTED" ? "default" : e.reviewDecision === "REFUSED" ? "destructive" : "secondary"}>
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
              {instrument.evaluations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
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
