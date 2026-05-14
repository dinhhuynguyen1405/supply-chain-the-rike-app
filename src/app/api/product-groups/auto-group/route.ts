import { prisma } from "@/lib/prisma";

// POST /api/product-groups/auto-group
// Automatically creates ProductGroups based on nameVi, then assigns products.
// Products without nameVi are skipped (left ungrouped).
// Idempotent: re-running merges into existing groups by name.
export async function POST() {
  // 1. Fetch all products that have a nameVi
  const products = await prisma.product.findMany({
    where: { nameVi: { not: null } },
    select: { id: true, nameVi: true },
  });

  // 2. Group product IDs by nameVi
  const byName = new Map<string, string[]>();
  for (const p of products) {
    const key = (p.nameVi as string).trim();
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(p.id);
  }

  // Only auto-group names that have 2+ products
  const multiNames = [...byName.entries()].filter(([, ids]) => ids.length >= 2);

  // 3. Fetch existing groups by name to avoid duplicates
  const existingGroups = await prisma.productGroup.findMany({
    select: { id: true, name: true },
  });
  const existingByName = new Map(existingGroups.map(g => [g.name, g.id]));

  let created = 0;
  let updated = 0;
  let assigned = 0;

  for (const [name, productIds] of multiNames) {
    let groupId = existingByName.get(name);

    // Create group if it doesn't exist
    if (!groupId) {
      const g = await prisma.productGroup.create({
        data: { name, costUnit: "kg" },
      });
      groupId = g.id;
      created++;
    } else {
      updated++;
    }

    // Assign all products in this nameVi to the group
    const result = await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { groupId },
    });
    assigned += result.count;
  }

  return Response.json({
    ok: true,
    groupsCreated: created,
    groupsReused: updated,
    productsAssigned: assigned,
    totalGroups: multiNames.length,
  });
}
