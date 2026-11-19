import { CsvError as ParseError, parse } from "csv-parse/sync";

export const cell = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);

export class CsvError extends Error {
    line: number;

    constructor(line: number, message: string) {
        super(`Line ${line}: ${message}`);
        this.line = line;
    }
}

export function parseCsv(text: string) {
    const rows: { line: number, cells: string[] }[] = [];
    try {
        parse(text, {
            bom: true,
            skip_empty_lines: true,
            relax_column_count: true,
            relax_quotes: true,
            on_record: (record: string[], { lines }) => {
                rows.push({ line: lines, cells: record });
                return null;
            },
        });
    } catch (err) {
        if (!(err instanceof ParseError)) throw err;
        throw new CsvError(Number(err.lines), err.code === "CSV_QUOTE_NOT_CLOSED" ? "a quoted value is never closed" : "the file is not valid CSV");
    }
    return rows;
}
