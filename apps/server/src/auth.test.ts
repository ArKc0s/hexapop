import { test } from "node:test";
import assert from "node:assert/strict";
import { scryptSync, randomBytes } from "node:crypto";
process.env.DB_PATH = ":memory:";
const { hashPassword, verifyPassword } = await import("./auth.ts");

test("hachage scrypt versionné, sel unique, mise à niveau de l'ancien format", async () => {
  const a = await hashPassword("motdepasse"), b = await hashPassword("motdepasse");
  assert.notEqual(a, b, "sel aléatoire");
  assert.match(a, /^scrypt\$32768\$8\$3\$/);
  assert.deepEqual(await verifyPassword("motdepasse", a), { ok: true, rehash: false });
  assert.equal((await verifyPassword("mauvais", a)).ok, false);
  const salt = randomBytes(16);
  const old = ["scrypt", salt.toString("base64"), scryptSync("motdepasse", salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("base64")].join("$");
  assert.deepEqual(await verifyPassword("motdepasse", old), { ok: true, rehash: true });
});
