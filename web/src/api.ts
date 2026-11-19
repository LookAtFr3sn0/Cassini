export class Unauthorized extends Error {}

export class HttpError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

export async function api<T>(path: string, options: { method?: string, body?: unknown } = {}): Promise<T> {
    const hasBody = options.body !== undefined;
    const response = await fetch(path, {
        method: options.method ?? "GET",
        headers: hasBody ? { "Content-Type": "application/json" } : undefined,
        body: hasBody ? JSON.stringify(options.body) : undefined,
    });
    if (response.status === 401) throw new Unauthorized();
    if (!response.ok) throw new HttpError(response.status, `${response.status} ${response.statusText}`);
    return response.status === 204 ? (undefined as T) : response.json();
}
