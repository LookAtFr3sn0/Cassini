export type Params = Record<string, string>
export type Result = Record<string, unknown>
export type Handler = (params: Params) => Promise<Result>

//? https://www.last.fm/api/errorcodes
export const LastfmErrorCode = {
    InvalidMethod: 3,
    AuthenticationFailed: 4,
    InvalidFormat: 5,
    InvalidParameters: 6,
    InvalidSessionKey: 9,
    InvalidSignature: 13,
    ServiceTemporarilyUnavailable: 16,
} as const;

export class LastfmError extends Error {
    constructor(
        public code: number,
        message: string,
    ) {
        super(message);
    }
}

export function escapeXml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}

const scalar = (value: unknown) => typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";

export function toXml(name: string, value: unknown): string {
    if (Array.isArray(value)) {
        return value.map((item) => toXml(name, item)).join("");
    }
    if (value === null || typeof value !== "object") {
        return `<${name}>${escapeXml(scalar(value))}</${name}>`;
    }

    const { "#text": text, "@attr": attr, ...rest } = value as Record<string, unknown>;
    const attrs = { ...(attr as Record<string, unknown> | undefined), ...(text === undefined ? {} : rest) };
    const children = text === undefined ? rest : {};
    const attrText = Object.entries(attrs).map(([key, value]) => ` ${key}="${escapeXml(scalar(value))}"`).join("");
    const body = text === undefined ? Object.entries(children).map(([key, value]) => toXml(key, value)).join("") : escapeXml(scalar(text));
    return `<${name}${attrText}>${body}</${name}>`;
}
