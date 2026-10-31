import { describe, expect, it } from "@jest/globals";
import { getMinorDigits, SUPPORTED_CURRENCIES, toMinorUnits } from "../../src/utils/money";

describe("toMinorUnits", () => {
    it.each([
        [150.5, 2, 15050],
        [1.05, 2, 105],
        [0.1, 2, 10],
        [100, 2, 10000],
        [0, 2, 0],
        [500, 0, 500],
        [1.234, 3, 1234],
    ])("converts %p with %p decimal places to %p", (amount, digits, expected) => {
        expect(toMinorUnits(amount, digits)).toBe(expected);
    });

    it("converts exactly where multiplying would not", () => {
        expect(0.29 * 100).not.toBe(29);
        expect(toMinorUnits(0.29, 2)).toBe(29);
        expect(1.005 * 1000).not.toBe(1005);
        expect(toMinorUnits(1.005, 3)).toBe(1005);
    });

    it.each([
        ["more decimals than the currency allows", 1.005, 2],
        ["a decimal in a currency without minor units", 150.5, 0],
        ["a negative amount", -5, 2],
        ["a string", "150.5", 2],
        ["null", null, 2],
        ["undefined", undefined, 2],
        ["NaN", Number.NaN, 2],
        ["Infinity", Number.POSITIVE_INFINITY, 2],
        ["a number in exponent notation", 1e21, 2],
        ["a result too large to store exactly", 2 ** 53, 2],
    ])("returns null for %s", (_description, amount, digits) => {
        expect(toMinorUnits(amount, digits)).toBeNull();
    });
});

describe("getMinorDigits", () => {
    it.each([
        ["NGN", 2],
        ["USD", 2],
        ["JPY", 0],
        ["KWD", 3],
    ])("%s has %p decimal places", (currency, digits) => {
        expect(getMinorDigits(currency)).toBe(digits);
    });
});

describe("SUPPORTED_CURRENCIES", () => {
    it("contains real ISO 4217 codes only", () => {
        expect(SUPPORTED_CURRENCIES).toEqual(expect.arrayContaining(["NGN", "USD", "EUR", "JPY"]));
        expect(SUPPORTED_CURRENCIES).not.toContain("XYZ");
    });
});
