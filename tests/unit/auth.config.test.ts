import { describe, expect, it } from "@jest/globals";
import { hashApiKey, parseApiKeys } from "../../src/config/auth.config";

const HASH = hashApiKey("secret").toString("hex");

describe("hashApiKey", () => {
    it("returns the SHA-256 digest", () => {
        expect(hashApiKey("abc").toString("hex")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    });
});

describe("parseApiKeys", () => {
    it("parses name:role:hash entries and ignores blanks and spaces", () => {
        const keys = parseApiKeys(` billing:write:${HASH} , ,reporting:read:${HASH.toUpperCase()}`);

        expect(keys).toHaveLength(2);
        expect(keys[0]).toMatchObject({ name: "billing", role: "write" });
        expect(keys[1]).toMatchObject({ name: "reporting", role: "read" });
        expect(keys[0].hash.equals(hashApiKey("secret"))).toBe(true);
    });

    it.each([
        ["is not set", undefined, "at least one key"],
        ["is empty", " , ", "at least one key"],
        ["has a missing part", "billing:write", "name:role:sha256-hash"],
        ["has an extra part", `billing:write:${HASH}:extra`, "name:role:sha256-hash"],
        ["has an unknown role", `billing:admin:${HASH}`, 'role "admin"'],
        ["has a hash that isn't SHA-256 hex", "billing:write:not-a-hash", "64-character hex"],
        ["has a duplicate name", `billing:write:${HASH},billing:read:${HASH}`, 'more than one entry named "billing"'],
    ])("throws when the value %s", (_description, value, message) => {
        expect(() => parseApiKeys(value)).toThrow(message);
    });
});
