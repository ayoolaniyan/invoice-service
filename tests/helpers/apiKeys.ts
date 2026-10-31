import { hashApiKey } from "../../src/config/auth.config";

export const READ_KEY = "test-read-key";
export const WRITE_KEY = "test-write-key";

export const TEST_API_KEYS = [
    `test-reader:read:${hashApiKey(READ_KEY).toString("hex")}`,
    `test-writer:write:${hashApiKey(WRITE_KEY).toString("hex")}`,
].join(",");
