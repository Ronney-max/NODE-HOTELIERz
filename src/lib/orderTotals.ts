import type { Prisma } from "@prisma/client";

export type OrderForTotals = {
  discount: Prisma.Decimal | number;
  items: { quantity: number; unitPrice: Prisma.Decimal | number; addons: { quantity: number; unitPrice: Prisma.Decimal | number }[] }[];
};

export type TaxSettings = { taxRate: Prisma.Decimal | number | null; taxMode: "INCLUSIVE" | "EXCLUSIVE" } | null | undefined;

/** Single source of truth for order money math, shared by the POS order
 * routes and the sales report so a discount or the tenant's tax rate never
 * gets computed two different ways in two different places. */
export function computeOrderFinancials(order: OrderForTotals, tax: TaxSettings) {
  const subtotal = order.items.reduce((sum, item) => {
    const addonsTotal = item.addons.reduce((s, a) => s + Number(a.unitPrice) * a.quantity, 0);
    return sum + (Number(item.unitPrice) + addonsTotal) * item.quantity;
  }, 0);
  const discount = Math.min(Number(order.discount), subtotal);
  const taxable = subtotal - discount;
  const rate = tax?.taxRate != null ? Number(tax.taxRate) : 0;
  const taxMode = tax?.taxMode ?? "INCLUSIVE";

  let taxAmount = 0;
  let total = taxable;
  if (rate > 0) {
    if (taxMode === "EXCLUSIVE") {
      // Tax is added on top of the taxable amount.
      taxAmount = taxable * (rate / 100);
      total = taxable + taxAmount;
    } else {
      // Tax is already baked into item prices — extract the tax portion.
      taxAmount = taxable - taxable / (1 + rate / 100);
      total = taxable;
    }
  }

  return {
    subtotal: round2(subtotal),
    discount: round2(discount),
    taxable: round2(taxable),
    taxRate: rate,
    taxMode,
    taxAmount: round2(taxAmount),
    total: round2(total),
  };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
