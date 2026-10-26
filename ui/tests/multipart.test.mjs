import assert from "node:assert/strict";
import test from "node:test";

import { hasValidMultipartBoundary } from "../lib/multipart.ts";

test("ordinary content types pass through", () => {
  for (const value of [null, "", "application/json", "text/plain", "application/x-www-form-urlencoded"]) {
    assert.equal(hasValidMultipartBoundary(value), true, String(value));
  }
});

test("browser and quoted multipart boundaries are accepted", () => {
  for (const value of [
    "multipart/form-data; boundary=----WebKitFormBoundaryabc123",
    "multipart/form-data; boundary=--------------------------1234567890",
    'multipart/form-data; boundary="a boundary with spaces"',
    'Multipart/Form-Data; charset=utf-8; boundary="a:b/c?d=e(f)+g,h_i-j.k"',
    `multipart/form-data; boundary=${"a".repeat(70)}`,
    "multipart/form-data; boundary=a",
  ]) {
    assert.equal(hasValidMultipartBoundary(value), true, value);
  }
});

test("missing, empty, oversized, and invalid boundaries are rejected", () => {
  for (const value of [
    "multipart/form-data",
    "multipart/form-data; charset=utf-8",
    "multipart/form-data; boundary=",
    'multipart/form-data; boundary=""',
    'multipart/form-data; boundary=" "',
    'multipart/form-data; boundary="trailing "',
    'multipart/form-data; boundary="non-ascii-é"',
    'multipart/form-data; boundary="invalid;character"',
    `multipart/form-data; boundary=${"a".repeat(71)}`,
    "multipart/form-data, application/json",
    "multipart/form-datax; boundary=a",
  ]) {
    assert.equal(hasValidMultipartBoundary(value), false, value);
  }
});
