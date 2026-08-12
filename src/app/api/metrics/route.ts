import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/* GET /api/metrics?userId=xxx */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

  const entries = await db.campaignEntry.findMany({
    where: { userId },
    orderBy: { date: "desc" },
  });

  const totals = entries.reduce(
    (acc, e) => {
      acc.revenue += e.revenue;
      acc.investment += e.investment;
      acc.sales += e.sales;
      return acc;
    },
    { revenue: 0, investment: 0, sales: 0 }
  );

  return NextResponse.json({ entries, totals });
}

/* POST /api/metrics — upsert by userId+date */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, date, revenue, investment, sales } = body;
    if (!userId || !date) {
      return NextResponse.json({ error: "userId y date son requeridos" }, { status: 400 });
    }

    const entry = await db.campaignEntry.upsert({
      where: { userId_date: { userId, date } },
      update: {
        revenue: parseFloat(revenue) || 0,
        investment: parseFloat(investment) || 0,
        sales: parseInt(sales) || 0,
      },
      create: {
        userId,
        date,
        revenue: parseFloat(revenue) || 0,
        investment: parseFloat(investment) || 0,
        sales: parseInt(sales) || 0,
      },
    });

    return NextResponse.json(entry);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al guardar";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* DELETE /api/metrics?id=xxx&userId=xxx */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const userId = req.nextUrl.searchParams.get("userId");
  if (!id || !userId) return NextResponse.json({ error: "id y userId requeridos" }, { status: 400 });

  await db.campaignEntry.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
