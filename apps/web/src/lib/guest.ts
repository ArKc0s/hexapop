// Identité d'invité pour le classement du défi du jour : un identifiant tiré au hasard, gardé par ce navigateur.
// Créé seulement quand on joue le défi ; repris par le compte à l'inscription ou à la connexion (puis oublié).
const KEY = "hexa.guestId";

export function guestId(create = false): string | null {
  try {
    let id = localStorage.getItem(KEY);
    if (!id && create) {
      const b = crypto.getRandomValues(new Uint8Array(18));
      id = btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch { return null; }
}
export function forgetGuest() { try { localStorage.removeItem(KEY); } catch { /* navigation privée */ } }
