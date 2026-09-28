import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function InstrumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const raw = (await searchParams).q;
  const q = typeof raw === "string" ? raw.trim().slice(0, 80) || undefined : undefined;
  const instruments = await db.instrument.findMany({
    where: q
      ? {
          OR: [
            { manufacturer: { contains: q, mode: "insensitive" } },
            { model: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { _count: { select: { evaluations: true } } },
    orderBy: { manufacturer: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Instruments</h1>
          <p className="text-xs text-muted-foreground">Registered non-automatic weighing instruments (NAWI)</p>
        </div>
        <Button render={<Link href="/instruments/new" />} nativeButton={false}>
          New instrument
        </Button>
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search manufacturer or model…"
            className="h-8 w-full rounded-xs border border-input bg-card/60 px-3 py-1 text-sm outline-none transition-all duration-150 placeholder:text-muted-foreground/70 hover:border-[#aab5a4] focus-visible:border-primary focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Search
        </Button>
        {q ? (
          <Link href="/instruments" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 ml-1">
            Clear
          </Link>
        ) : null}
      </form>

      <Card className="rounded-xs border border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Manufacturer</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Max</TableHead>
                <TableHead className="text-right">e</TableHead>
                <TableHead className="text-right pr-4">Evaluations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instruments.map((i) => (
                <TableRow key={i.id} className="group">
                  <TableCell className="font-bold text-foreground">{i.manufacturer}</TableCell>
                  <TableCell>
                    <Link
                      href={`/instruments/${i.id}`}
                      className="font-mono text-xs font-semibold text-primary underline underline-offset-4 decoration-border group-hover:decoration-primary transition-colors"
                    >
                      {i.model}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded-2xs border border-border">
                      {i.class}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">{i.maxG} g</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">{i.eG} g</TableCell>
                  <TableCell className="text-right pr-4 font-mono text-xs tabular-nums text-muted-foreground">
                    {i._count.evaluations}
                  </TableCell>
                </TableRow>
              ))}
              {instruments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No instruments{q ? ` matching "${q}"` : ""}.
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
