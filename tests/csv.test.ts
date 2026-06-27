import { describe, it, expect } from "vitest";
import { toCsv } from "../app/lib/csv";

describe("toCsv", () => {
  it("joins headers and rows with CRLF and a UTF-8 BOM", () => {
    const csv = toCsv(["a", "b"], [["1", "2"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("a,b\r\n1,2");
  });

  it("quotes fields containing commas, quotes, or newlines", () => {
    const csv = toCsv(["x"], [["has,comma"], ['has"quote'], ["has\nnewline"]]);
    expect(csv).toContain('"has,comma"');
    expect(csv).toContain('"has""quote"'); // embedded quote doubled
    expect(csv).toContain('"has\nnewline"');
  });

  it("leaves simple fields unquoted", () => {
    expect(toCsv(["x"], [["plain"]])).toContain("\nplain");
  });
});
