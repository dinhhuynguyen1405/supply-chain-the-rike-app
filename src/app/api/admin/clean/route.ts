import { prisma } from "@/lib/prisma";

export async function POST() {
  // Delete all purchase orders and cascade (payments, items)
  await prisma.payment.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  // Delete all suppliers
  await prisma.supplier.deleteMany();
  // Keep all products - user will manage manually
  return Response.json({ ok: true, message: "Đã xoá dữ liệu test" });
}
