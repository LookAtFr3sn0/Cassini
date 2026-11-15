import { randomBytes, argon2, timingSafeEqual, type Argon2Parameters } from "node:crypto";
import { promisify } from "node:util";

const argon2Async = promisify(argon2);

const parameters: Argon2Parameters = {
    message: "password",
    nonce: randomBytes(16),
    parallelism: 2,
    tagLength: 32,
    memory: 1<<16,
    passes: 1,
}

const b64 = (buffer: Buffer) => buffer.toString("base64").replaceAll("=", "")

export async function hashPassword(password: string): Promise<string> {
    const hashParameters = {
        ...parameters,
        message: Buffer.from(password),
        nonce: randomBytes(16),
    };

    const hash = await argon2Async("argon2id", hashParameters);
    return `$argon2id$v=19$m=${hashParameters.memory},t=${hashParameters.passes},p=${hashParameters.parallelism}$${b64(hashParameters.nonce)}$${b64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
    const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/.exec(stored);
    if (!match) return false;
    const [, memory, passes, parallelism, nonceB64, tagB64] = match;
    const expected = Buffer.from(tagB64!, "base64");
    const hashParameters = {
        message: Buffer.from(password),
        nonce: Buffer.from(nonceB64!, "base64"),
        memory: parseInt(memory!),
        passes: parseInt(passes!),
        parallelism: parseInt(parallelism!),
        tagLength: expected.length,
    }
    const actual = await argon2Async("argon2id", hashParameters);
    return timingSafeEqual(expected, actual); 
}
