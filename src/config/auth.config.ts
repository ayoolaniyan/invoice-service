import { createHash } from "crypto";

export const API_KEY_ROLES = ["read", "write"] as const;

export type ApiKeyRole = (typeof API_KEY_ROLES)[number];

export interface IApiClient {
    name: string;
    role: ApiKeyRole;
}

interface IApiKeyEntry extends IApiClient {
    hash: Buffer;
}

export function hashApiKey(apiKey: string): Buffer {
    return createHash("sha256").update(apiKey, "utf8").digest();
}

/**
 * Parses API_KEYS, a comma-separated list of `name:role:sha256-hex-hash` entries.
 * Only hashes are kept in the environment, so a leaked config does not leak usable keys.
 * Generate an entry with `npm run api-key:generate -- <name> <role>`.
 */
export function parseApiKeys(value: string | undefined): IApiKeyEntry[] {
    const entries = (value ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

    if (entries.length === 0) {
        throw new Error("API_KEYS must contain at least one key");
    }

    const names = new Set<string>();

    return entries.map((entry, index) => {
        const [name, role, hash, ...rest] = entry.split(":");

        if (!name || !role || !hash || rest.length > 0) {
            throw new Error(`API_KEYS entry ${index + 1} must look like name:role:sha256-hash`);
        }
        if (!API_KEY_ROLES.includes(role as ApiKeyRole)) {
            throw new Error(`API_KEYS entry "${name}" has role "${role}"; use one of: ${API_KEY_ROLES.join(", ")}`);
        }
        if (!/^[a-f0-9]{64}$/i.test(hash)) {
            throw new Error(`API_KEYS entry "${name}" must have a 64-character hex SHA-256 hash`);
        }
        if (names.has(name)) {
            throw new Error(`API_KEYS has more than one entry named "${name}"`);
        }
        names.add(name);

        return { name, role: role as ApiKeyRole, hash: Buffer.from(hash, "hex") };
    });
}

let apiKeys: IApiKeyEntry[] | undefined;

export function getApiKeys(): IApiKeyEntry[] {
    apiKeys ??= parseApiKeys(process.env.API_KEYS);
    return apiKeys;
}
