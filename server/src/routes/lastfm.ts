import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import formbody from "@fastify/formbody";

type Params = Record<string, string>
type Result = { json: unknown; xml: string }
type Handler = (params: Params) => Promise<Result>

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

function notImplemented(name: string): Handler {
    return async () => {
        throw new LastfmError(LastfmErrorCode.InvalidMethod, `Method ${name} is not implemented`);
    }
}

const handlers: Record<string, Handler> = {
    "auth.getMobileSession": notImplemented("auth.getMobileSession"),
    "track.updateNowPlaying": notImplemented("track.updateNowPlaying"),
    "track.scrobble": notImplemented("track.scrobble")
};

function send(reply: FastifyReply, wantsJson: boolean, status: number, result: Result) {
    if (wantsJson) return reply.code(status).send(result.json);
    return reply
        .code(status)
        .type("text/xml; charset=utf-8")
        .send(`<?xml version="1.0" encoding="utf-8"?>\n${result.xml}`);
}

export async function lastfmRoutes(app: FastifyInstance) {
    await app.register(formbody);

    for (const url of ["/2.0", "/2.0/"]) {
        app.route({
            method: ["GET", "POST"],
            url,
            handler: async (request: FastifyRequest, reply: FastifyReply) => {
                const params: Params = {
                    ...(request.query as Params),
                    ...(request.body as Params | undefined)
                };
                const wantsJson = params.format === "json";

                try {
                    const handler = handlers[(params.method ?? "")];
                    if (!handler) {
                        throw new LastfmError(LastfmErrorCode.InvalidMethod, "Invalid method");
                    }
                    const result = await handler(params);
                    return send(reply, wantsJson, 200, {
                        json: result.json,
                        xml: `<lfm status="ok">${result.xml}</lfm>`
                    });
                } catch (err) {
                    if (!(err instanceof LastfmError)) throw err;
                    return send(reply, wantsJson, 400, {
                        json: { error: err.code, message: err.message },
                        xml: `<lfm status="failed"><error code="${err.code}">${escapeXml(err.message)}</error></lfm>`
                    });
                }
            }
        });
    }
}
