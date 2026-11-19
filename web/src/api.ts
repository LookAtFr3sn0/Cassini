export class Unauthorized extends Error {}

export class HttpError extends Error {
    status: number;
    details: string | undefined;

    constructor(status: number, message: string, detail?: string) {
        super(message);
        this.status = status;
        this.details = detail;
    }
}

export async function api<T>(path: string, options: { method?: string, body?: unknown } = {}): Promise<T> {
    const hasBody = options.body !== undefined;
    const file = options.body instanceof Blob ? options.body : undefined;
    const response = await fetch(path, {
        method: options.method ?? "GET",
        headers: file ? { "Content-Type": file.type } : hasBody ? { "Content-Type": "application/json" } : undefined,
        body: file ?? (hasBody ? JSON.stringify(options.body) : undefined),
    });
    if (response.status === 401) throw new Unauthorized();
    if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new HttpError(response.status, `${response.status} ${response.statusText}`, data?.error);
    }
    return response.status === 204 ? (undefined as T) : response.json();
}
