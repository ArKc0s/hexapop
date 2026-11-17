// Invitation à créer un compte, pour les invités. Principe : demander aux bons moments, pas souvent, et jamais de force.
// - Au bon moment : après la 1re partie, après un vrai moment (médaille, série, grand voyage), et après le défi du jour
//   (classement sous ton pseudo). Sinon de moins en moins souvent : toutes les 2, 3, 5, 8 puis 13 parties.
// - Jamais deux fois le même jour, jamais pendant une partie (voir SignupPrompt).
// - Après deux « Plus tard », on propose « Ne plus me proposer » : la fenêtre ne revient plus, il reste seulement
//   les rappels discrets (bulle d'Hexa à l'accueil, carte en fin de partie), qui ne bloquent rien.
const KEY = "hexa.signup";
const OLD_KEY = "hexa.signup.last";
const GAPS = [2, 3, 5, 8, 13];

export interface SignupReason {
  kind: "solo" | "daily" | "multi";
  xp?: number;
  stars?: number;
  firstGame?: boolean;
  /** Un vrai moment à ne pas perdre (« ta première médaille », « ta série de 3 jours »…). */
  moment?: string;
  /** Pseudo généré sous lequel l'invité est classé au défi. */
  guestName?: string;
  /** Parties jouées en tout (pour espacer les rappels). */
  games?: number;
}
interface Memo { dismissed: number; lastAt: number; lastGames: number; never: boolean }

const day = (t: number) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date(t));

class Signup {
  reason = $state<SignupReason | null>(null);
  memo = $state<Memo>(this.load());

  private load(): Memo {
    const m: Memo = { dismissed: 0, lastAt: 0, lastGames: 0, never: false };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...m, ...JSON.parse(raw) };
      m.lastAt = Number(localStorage.getItem(OLD_KEY) ?? 0);
    } catch { /* navigation privée */ }
    return m;
  }
  private save() { try { localStorage.setItem(KEY, JSON.stringify(this.memo)); } catch { /* rien */ } }

  /** L'invité a choisi de ne plus voir la fenêtre. */
  get never() { return this.memo.never; }
  /** « Ne plus me proposer » n'apparaît qu'après deux refus. */
  get canStop() { return this.memo.dismissed >= 2; }

  offer(r: SignupReason) {
    if (this.memo.never) return;
    const now = Date.now();
    if (this.memo.lastAt && day(this.memo.lastAt) === day(now)) return;
    const games = r.games ?? 0;
    const gap = GAPS[Math.min(this.memo.dismissed, GAPS.length - 1)];
    if (r.kind === "daily" || r.firstGame || r.moment || games - this.memo.lastGames >= gap) {
      this.reason = r;
      this.memo = { ...this.memo, lastAt: now, lastGames: games };
      this.save();
    }
  }
  /** « Plus tard » (ou fermeture) : le prochain rappel attendra davantage. */
  close() {
    if (this.reason) this.memo = { ...this.memo, dismissed: this.memo.dismissed + 1 };
    this.reason = null;
    this.save();
  }
  /** Vers la création de compte : ce n'est pas un refus. */
  accept() { this.reason = null; this.save(); }
  stop() { this.memo = { ...this.memo, never: true }; this.reason = null; this.save(); }
}
export const signup = new Signup();
