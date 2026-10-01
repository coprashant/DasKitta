import test from "node:test";
import assert from "node:assert/strict";

import { clampChartWindow } from "./nepseUtils.js";

test("clampChartWindow keeps a valid window within the data range", () => {
  assert.deepEqual(clampChartWindow(60, -5, 200, 12), {
    start: 0,
    size: 60,
  });

  assert.deepEqual(clampChartWindow(60, 55, 10, 12), {
    start: 48,
    size: 12,
  });

  assert.deepEqual(clampChartWindow(60, 20, 14, 12), {
    start: 20,
    size: 14,
  });
});
