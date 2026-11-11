import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASE_PATH } from "../site.config.js";
import viteConfig from "../vite.config.js";

const root = fileURLToPath(new URL("../", import.meta.url));

test("project identifiers stay consistent across manifest and lockfile", async () => {
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
  assert.equal(manifest.name, "ingress-banner-atlas");
  assert.equal(lock.name, manifest.name);
  assert.equal(lock.packages[""].name, manifest.name);
  assert.equal(manifest.repository.url, `git+https://github.com/Choujingress/${manifest.name}.git`);
});

test("Vite serves the application from the site root", () => {
  assert.equal(BASE_PATH, "/");
  assert.equal(viteConfig.base, BASE_PATH);
});
