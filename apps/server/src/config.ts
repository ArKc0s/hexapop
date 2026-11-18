export const config = {
  port: Number(process.env.PORT ?? 8787),
  dbPath: process.env.DB_PATH ?? "hexa.db",
  /** URL publique, utilisée dans les liens des emails. */
  publicUrl: process.env.PUBLIC_URL ?? "http://localhost:5173",
  /** Dossier du client web compilé (servi en production). */
  webDir: process.env.WEB_DIR ?? "",
  /** Secret de tirage du défi du jour (empêche de le calculer à l'avance). */
  dailySecret: process.env.DAILY_SECRET ?? "dev-secret",
  /** « preprod » : bandeau dans le jeu (voir deploy/compose.preprod.yaml). */
  env: process.env.HEXA_ENV ?? "prod",
  /** Comptes admins (identifiants séparés par des virgules) : soirées publiques annoncées sur Discord. */
  admins: new Set((process.env.HEXA_ADMINS ?? "").split(",").map((x) => Number(x.trim())).filter((n) => n > 0)),
  /** Jeton de lecture des statistiques (Grafana) ; sans jeton, la route est fermée. */
  statsToken: process.env.STATS_TOKEN ?? "",
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 465),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@hexapop.app",
  },
};
