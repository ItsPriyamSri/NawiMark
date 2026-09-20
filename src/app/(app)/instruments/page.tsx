import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function InstrumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Instruments</h1>
        <Button render={<Link href="/instruments/new" />} nativeButton={false}>
          New instrument
        </Button>
      </div>
      <form className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search manufacturer or model…"
          className="h-8 w-64 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Manufacturer</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Max</TableHead>
                <TableHead>e</TableHead>
                <TableHead>Evaluations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instruments.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.manufacturer}</TableCell>
                  <TableCell>
                    <Link href={`/instruments/${i.id}`} className="underline underline-offset-4">
                      {i.model}
                    </Link>
                  </TableCell>
                  <TableCell>{i.class}</TableCell>
                  <TableCell>{i.maxG} g</TableCell>
                  <TableCell>{i.eG} g</TableCell>
                  <TableCell>{i._count.evaluations}</TableCell>
                </TableRow>
              ))}
              {instruments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
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
