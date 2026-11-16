function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing environment variable: ${name}`);
    return value;
}

export const config = {
    databaseUrl: required("DATABASE_URL"),
    port: Number(process.env.PORT ?? 3000),
    host: process.env.HOST || "0.0.0.0",
    singleUser: (process.env.SINGLE_USER ?? "true").toLowerCase() === "true",
};
