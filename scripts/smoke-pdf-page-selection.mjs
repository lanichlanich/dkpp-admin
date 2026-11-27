import assert from "node:assert/strict";
import { test } from "node:test";

const selection = await import("../src/components/tools/pdf-page-selection.ts").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {};
  throw error;
});

const page = (fileIndex, pageNumber) => ({ fileIndex, pageNumber });

test("Merge sends the exact interleaved order for every source page", () => {
  const pages = [page(0, 1), page(0, 2), page(1, 1), page(1, 2)];
  const moved = selection.movePdfPage(pages, 2, 1);
  assert.deepEqual(pages, [page(0, 1), page(0, 2), page(1, 1), page(1, 2)]);
  assert.deepEqual(moved, [page(0, 1), page(1, 1), page(0, 2), page(1, 2)]);
  assert.equal(selection.encodeMergePageOrder(moved, [2, 2]), "[[0,1],[1,1],[0,2],[1,2]]");
});

test("Merge refuses missing, duplicate or out-of-range pages", () => {
  assert.equal(selection.encodeMergePageOrder([page(0, 1)], [2]), null);
  assert.equal(selection.encodeMergePageOrder([page(0, 1), page(0, 1)], [1, 1]), null);
  assert.equal(selection.encodeMergePageOrder([page(1, 1)], [1]), null);
  assert.equal(selection.encodeMergePageOrder([page(0, 2)], [1]), null);
  assert.equal(selection.encodeMergePageOrder([page(0, 0)], [1]), null);
});

test("Split combines noncontiguous selected pages in source order", () => {
  assert.equal(selection.encodeSplitRanges(new Set([4, 1, 3]), 5, "combined"), "1,3-4");
});

test("Split sends semicolon-separated pages for individual outputs", () => {
  assert.equal(selection.encodeSplitRanges(new Set([4, 1, 3]), 5, "individual"), "1;3;4");
  assert.equal(selection.encodeSplitRanges(new Set([8, 7, 6, 5, 4, 3, 2, 1]), 9, "individual"), "1;2;3;4;5;6;7;8");
  assert.equal(selection.encodeSplitRanges(new Set([9, 8, 7, 6, 5, 4, 3, 2, 1]), 9, "individual"), null);
});

test("Split refuses empty, invalid or out-of-range selections", () => {
  assert.equal(selection.encodeSplitRanges(new Set(), 5, "combined"), null);
  assert.equal(selection.encodeSplitRanges(new Set([0, 1]), 5, "combined"), null);
  assert.equal(selection.encodeSplitRanges(new Set([3, 6]), 5, "combined"), null);
});
