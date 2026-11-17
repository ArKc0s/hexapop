export const config = {
  port: Number(process.env.PORT ?? 8787),
  dbPath: process.env.DB_PATH ?? "hexa.db",
  /** URL publique, utilisée dans les liens des emails. */
  publicUrl: process.env.PUBLIC_URL ?? "http://localhost:5173",
  /** Dossier du client web compilé (servi en production). */
  webDir: process.env.WEB_DIR ?? "",
  /** Secret de tirage du défi du jour (empêche de le calculer à l'avance). */
  dailySecret: process.env.DAILY_SECRET ?? "dev-secret",
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
