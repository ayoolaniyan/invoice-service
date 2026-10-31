/**
 * Generates a new API key and the API_KEYS entry for it.
 *
 * Usage:
 *   npm run api-key:generate -- <name> <read|write>
 *
 * Give the key to the client and add the entry to API_KEYS. Only the hash is stored,
 * so the key can't be recovered later; generate a new one if it's lost.
 */
import { randomBytes } from "crypto";
import { API_KEY_ROLES, ApiKeyRole, hashApiKey } from "../src/config/auth.config";

const [name, role] = process.argv.slice(2);

if (!name || !/^[A-Za-z0-9_-]+$/.test(name) || !API_KEY_ROLES.includes(role as ApiKeyRole)) {
    console.error(`Usage: npm run api-key:generate -- <name> <${API_KEY_ROLES.join("|")}>`);
    console.error("The name may only contain letters, numbers, - and _");
    process.exit(1);
}

const apiKey = `inv_${randomBytes(32).toString("base64url")}`;
const entry = `${name}:${role}:${hashApiKey(apiKey).toString("hex")}`;

console.log(`API key for ${name} (shown once, give it to the client):\n  ${apiKey}\n`);
console.log(`Add this entry to API_KEYS (comma-separate multiple entries):\n  ${entry}`);
