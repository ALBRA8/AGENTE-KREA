import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

/* Helper: verify Bearer token and return user or 401 */
function getAuth(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return getSessionUser(token || "");
}

/* GET /api/metrics?userId=xxx — requires auth, userId must match token */
export async function GET(req: NextRequest) {
  const user = await getAuth(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const userId = req.nextUrl.searchParams.get("userId") || user.id;
  // Users can only read their own metrics
  if (userId !== user.id) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });

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

/* POST /api/metrics — upsert by userId+date, requires auth */
export async function POST(req: NextRequest) {
  const user = await getAuth(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { date, revenue, investment, sales } = body;
    const userId = user.id; // Always use authenticated user's ID

    if (!date) {
      return NextResponse.json({ error: "date es requerido" }, { status: 400 });
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

/* DELETE /api/metrics?id=xxx — requires auth */
export async function DELETE(req: NextRequest) {
  const user = await getAuth(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  // Only delete entries belonging to authenticated user
  await db.campaignEntry.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
