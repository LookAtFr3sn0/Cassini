import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { apiTokens, users } from "../db/schema.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { LastfmError, LastfmErrorCode, type Handler, type Params } from "../lastfm/shared.js";

const dummyHash = hashPassword(randomBytes(16).toString("hex"));

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function findUserByLogin(username: string, password: string) {
    const [user] = await db
        .select()
        .from(users)
        .where(sql`lower(${users.username}) = ${username.toLowerCase()}`);
    const ok = await verifyPassword(password, user?.passwordHash ?? await dummyHash);
    return user && ok ? user : undefined;
}

export const getMobileSession: Handler = async (params: Params) => {
    const { username, password } = params;
    if (!username || !password) {
        throw new LastfmError(LastfmErrorCode.InvalidParameters, "Username and password are required");
    }

    const user = await findUserByLogin(username, password);
    if (!user) {
        throw new LastfmError(LastfmErrorCode.AuthenticationFailed, "Invalid username or password");
    }

    const key = randomBytes(16).toString("hex");
    await db.insert(apiTokens).values({
        userId: user.id,
        kind: "lastfm",
        tokenHash: hashToken(key),
        name: "Last.fm client",
    });

    return { session: { name: user.username, key, subscriber: 0 } };
};

export async function requireSession(params: Params) {
    const key = params.sk;
    if (!key) {
        throw new LastfmError(LastfmErrorCode.InvalidSessionKey, "Invalid session key");
    }

    const [row] = await db
        .select({ userId: apiTokens.userId })
        .from(apiTokens)
        .where(and(eq(apiTokens.tokenHash, hashToken(key)), eq(apiTokens.kind, "lastfm"), isNull(apiTokens.revokedAt)));
    
    if (!row) {
        throw new LastfmError(LastfmErrorCode.InvalidSessionKey, "Invalid session key");
    }
    return row.userId;
}
