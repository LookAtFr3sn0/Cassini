export type Params = Record<string, string>
export type Result = { json: unknown; xml: string }
export type Handler = (params: Params) => Promise<Result>

//? https://www.last.fm/api/errorcodes
export const LastfmErrorCode = {
    InvalidMethod: 3,
    AuthenticationFailed: 4,
    InvalidFormat: 5,
    InvalidParameters: 6,
    InvalidSessionKey: 9,
    InvalidSignature: 13,
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
