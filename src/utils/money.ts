// Available since Node 18, but not in the ES2020 lib this project compiles against
export const SUPPORTED_CURRENCIES: string[] = (Intl as unknown as { supportedValuesOf(key: "currency"): string[] }).supportedValuesOf("currency");

/** Number of decimal places in a currency's minor unit, e.g. 2 for NGN, 0 for JPY, 3 for KWD */
export function getMinorDigits(currency: string): number {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/**
 * Converts a decimal amount in major units (150.5) to integer minor units (15050).
 * Returns null when that can't be done exactly, instead of rounding.
 * Uses the number's decimal text, because multiplying is inexact (1.005 * 100 === 100.49999999999999).
 */
export function toMinorUnits(amount: unknown, minorDigits: number): number | null {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
        return null;
    }

    const text = amount.toString();
    if (/e/i.test(text)) {
        return null;
    }

    const [whole, fraction = ""] = text.split(".");
    if (fraction.length > minorDigits) {
        return null;
    }

    const minorUnits = Number(whole + fraction.padEnd(minorDigits, "0"));
    return Number.isSafeInteger(minorUnits) ? minorUnits : null;
}
