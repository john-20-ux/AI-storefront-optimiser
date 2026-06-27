// Minimal RFC-4180 CSV serializer — quotes fields containing commas, quotes,
// or newlines and escapes embedded quotes.

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  // Leading BOM so Excel opens UTF-8 correctly.
  return "﻿" + lines.join("\r\n");
}
