import { test } from "node:test";
import assert from "node:assert/strict";
import { issueBody, paris, podiumLines, questionOf, yesterday } from "./text.ts";

test("heure de Paris et veille", () => {
  // 2026-11-18 23:30 UTC = 19 novembre 0 h 30 à Paris (hiver, UTC+1)
  assert.deepEqual(paris(Date.parse("2026-11-18T23:30:00Z")), { day: "2026-11-19", hour: 0, minute: 30 });
  assert.equal(yesterday("2026-03-01"), "2026-02-28");
});

test("question du jour : la même toute la journée, 4 choix dont la bonne, sans doublon", () => {
  for (let i = 0; i < 400; i++) {
    const day = new Date(Date.parse("2026-01-01") + i * 86_400_000).toISOString().slice(0, 10);
    const q = questionOf(day);
    assert.deepEqual(q, questionOf(day));
    assert.equal(q.options.length, 4);
    assert.ok(q.options.includes(q.answer));
    assert.equal(new Set(q.options).size, 4, `${day} : ${q.options}`);
    assert.ok(q.question.endsWith("?") && q.detail.length > 10);
    assert.ok(q.options.every((o) => o.length <= 80), "libellé de bouton trop long");
  }
});

test("podium et texte d'issue (sans pseudo)", () => {
  assert.match(podiumLines([{ name: "Léo", home: null, points: 4299, elapsedMs: 95_000 }]), /🥇 \*\*Léo\*\* · 4 299 pts \(95 s\)/);
  assert.equal(podiumLines([]), "_personne pour l'instant_");
  const b = issueBody("Le bouton ne marche pas", "https://discord.com/channels/1/2", ["iPhone"]);
  assert.ok(b.includes("Le bouton ne marche pas") && b.includes("iPhone") && b.includes("https://discord.com/channels/1/2"));
  assert.ok(issueBody("", "u", []).includes("voir le fil"));
});
