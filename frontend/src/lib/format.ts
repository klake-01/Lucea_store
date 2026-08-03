/** Formats a minor unit amount as a Moroccan dirham price. */
export function formatMad(cents: number | undefined | null): string {
  const value = (cents ?? 0) / 100;
  const rounded = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2);
  return `${rounded} MAD`;
}

/** Free shipping threshold in minor units for the Casablanca and Rabat zones. */
export const FREE_SHIPPING_THRESHOLD_CENTS = 35000;

/** How much more the visitor needs to add to unlock free delivery. */
export function amountToFreeShipping(subtotalCents: number): number {
  return Math.max(0, FREE_SHIPPING_THRESHOLD_CENTS - subtotalCents);
}
