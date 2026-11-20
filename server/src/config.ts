function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing environment variable: ${name}`);
    return value;
}

function recommenders() {
    const list = new Map([["builtin", process.env.RECOMMENDER_URL || "http://recommender:8000"]]);
    for (const entry of (process.env.RECOMMENDERS ?? "").split(",")) {
        const [name, ...rest] = entry.split("=");
        const url = rest.join("=").trim();
        if (name?.trim() && url && name.trim() !== "builtin") {
            list.set(name.trim(), url);
        }
    }
    return list;
}

export const config = {
    databaseUrl: required("DATABASE_URL"),
    port: Number(process.env.PORT ?? 3000),
    host: process.env.HOST || "0.0.0.0",
    singleUser: (process.env.SINGLE_USER ?? "true").toLowerCase() === "true",
    recommendationsEnabled: (process.env.RECOMMENDATIONS_ENABLED ?? "true").toLowerCase() === "true",
    recommenders: recommenders(),
    recommenderDBPassword: required("RECOMMENDER_DB_PASSWORD"),
    secureCookies: (process.env.SECURE_COOKIES ?? "false").toLowerCase() === "true",
    webRoot: process.env.WEB_ROOT || "public",
};
