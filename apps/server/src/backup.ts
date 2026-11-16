// Copie cohérente de la base SQLite, même pendant que le serveur écrit (VACUUM INTO).
// Usage dans le conteneur : node apps/server/src/backup.ts /data/sauvegarde.db
// Restauration : arrêter le conteneur, remplacer /data/hexa.db par la copie (supprimer -wal/-shm), relancer.
import { DatabaseSync } from "node:sqlite";
import { rmSync, statSync } from "node:fs";

const src = process.env.DB_PATH ?? "hexa.db";
const dest = process.argv[2];
if (!dest) { console.error("usage : backup.ts <fichier de destination>"); process.exit(2); }

rmSync(dest, { force: true });
const db = new DatabaseSync(src, { readOnly: true });
db.exec(`VACUUM INTO '${dest.replaceAll("'", "''")}'`);
db.close();

const check = new DatabaseSync(dest, { readOnly: true });
const ok = (check.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check;
const users = (check.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
check.close();
if (ok !== "ok") { console.error(`copie corrompue : ${ok}`); process.exit(1); }
console.log(`copie OK : ${dest} (${statSync(dest).size} octets, ${users} comptes)`);
