import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Params, Result, Handler } from "../lastfm/shared.js";
import formbody from "@fastify/formbody";
import { LastfmError, LastfmErrorCode, escapeXml } from "../lastfm/shared.js";
import { getMobileSession } from "../lastfm/auth.js";


function notImplemented(name: string): Handler {
    return async () => {
        throw new LastfmError(LastfmErrorCode.InvalidMethod, `Method ${name} is not implemented`);
    }
}

const handlers: Record<string, Handler> = {
    "auth.getMobileSession": getMobileSession,
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
