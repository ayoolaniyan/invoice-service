import { afterEach, describe, expect, it } from "@jest/globals";
import { getCorsOptions, getTrustProxy, isApiDocsEnabled } from "../../src/config/security.config";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
});

describe("getCorsOptions", () => {
    it("refuses cross-origin requests when no origins are configured", () => {
        delete process.env.CORS_ORIGINS;
        expect(getCorsOptions().origin).toBe(false);
    });

    it("allows only the configured origins", () => {
        process.env.CORS_ORIGINS = "https://app.example.com, http://localhost:5173,";
        expect(getCorsOptions().origin).toEqual(["https://app.example.com", "http://localhost:5173"]);
    });

    it("allows the API key header and exposes Location", () => {
        const options = getCorsOptions();
        expect(options.allowedHeaders).toContain("X-API-Key");
        expect(options.exposedHeaders).toContain("Location");
    });
});

describe("getTrustProxy", () => {
    it.each([
        [undefined, false],
        ["", false],
        ["false", false],
        ["1", 1],
        ["2", 2],
        ["loopback", "loopback"],
    ])("TRUST_PROXY=%p gives %p", (value, expected) => {
        if (value === undefined) {
            delete process.env.TRUST_PROXY;
        } else {
            process.env.TRUST_PROXY = value;
        }
        expect(getTrustProxy()).toBe(expected);
    });
});

describe("isApiDocsEnabled", () => {
    it.each([
        [undefined, "development", true],
        [undefined, "production", false],
        ["true", "production", true],
        ["false", "development", false],
        ["TRUE", "production", true],
    ])("ENABLE_API_DOCS=%p with NODE_ENV=%p gives %p", (enableApiDocs, nodeEnv, expected) => {
        if (enableApiDocs === undefined) {
            delete process.env.ENABLE_API_DOCS;
        } else {
            process.env.ENABLE_API_DOCS = enableApiDocs;
        }
        process.env.NODE_ENV = nodeEnv;
        expect(isApiDocsEnabled()).toBe(expected);
    });
});
