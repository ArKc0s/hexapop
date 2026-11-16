// Fenêtre « Garde ta progression » pour les invités, en fin de partie.
const LAST_KEY = "hexa.signup.last";
const DAY = 86_400_000;

export interface SignupReason { kind: "solo" | "daily" | "multi"; xp?: number; vignettes?: number; firstGame?: boolean }

class Signup {
  reason = $state<SignupReason | null>(null);
  private last(): number { try { return Number(localStorage.getItem(LAST_KEY) ?? 0); } catch { return 0; } }

  /** Propose la création de compte : première partie, défi du jour, sinon au plus une fois par jour. */
  offer(r: SignupReason) {
    if (r.kind === "daily" || r.firstGame || Date.now() - this.last() > DAY) this.reason = r;
  }
  close() {
    this.reason = null;
    try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch { /* rien */ }
  }
}
export const signup = new Signup();
