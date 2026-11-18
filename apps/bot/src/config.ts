// Bot Discord d'Hexa : réglages. Les identifiants du serveur (salons, rôles) ne sont pas secrets ; le jeton du bot et
// celui de GitHub viennent de l'environnement (.env du serveur infra, jamais dans le dépôt).
const env = (k: string, d = "") => process.env[k] ?? d;

export const config = {
  token: env("DISCORD_TOKEN"),
  guild: env("DISCORD_GUILD", "1572549750555680860"),
  /** Hexa vu de l'intérieur (même réseau Docker que l'aiguilleur) et l'adresse publique pour les liens. */
  hexa: env("HEXA_URL", "http://hexapop-router:8787"),
  site: env("PUBLIC_URL", "https://hexapop.app"),
  github: { token: env("GITHUB_TOKEN"), repo: env("GITHUB_REPO", "ArKc0s/hexapop") },
  state: env("BOT_STATE", "/data/bot.json"),
  /** Heure de Paris des rendez-vous du jour. */
  at: { defi: 8, question: 12, podium: 21 },
  channels: {
    regles: "1572550550384414821", annonces: "1572550556927533098", nouveautes: "1572550558404055042", roadmap: "1572556423781548114",
    defi: "1572550559821594685", scores: "1572550561457512468", amis: "1572550562958942288",
    idees: "1572550564309372939", bugs: "1572550566008332343", general: "1572549752120279093", modo: "1572550551671930910",
  },
  roles: { equipe: "1572550529970741258", defi: "1572550531124035694", soiree: "1572550532151640125" },
  invite: "https://discord.gg/VBXbyXZW7t",
};
export const COLORS = { blue: 0x1572c4, pink: 0xff4fae, yellow: 0xffd93d, green: 0x22b07d, ink: 0x1c1a37 };
