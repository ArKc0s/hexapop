// L'atlas affiché (un atlas = un monde, docs/atlas.md) : celui du profil, départements par défaut.
// Un atlas en essai (Monde) n'est proposé qu'en préprod (et en local) : en prod, un profil qui l'aurait choisi
// retombe sur les départements, sans rien perdre (sa connaissance reste dans le profil).
import { ATLASES, offeredAtlases, type Atlas, type AtlasId } from "@hexa/game";
import { profile } from "./profile.svelte.ts";

const host = typeof location !== "undefined" ? location.hostname : "";
export const PREVIEW = host.startsWith("preprod.") || host === "localhost" || host === "127.0.0.1";
const OFFERED = offeredAtlases(PREVIEW);

export const world = {
  get id(): AtlasId { const a = profile.data.atlas ?? "france"; return OFFERED.includes(a) ? a : "france"; },
  get atlas(): Atlas { return ATLASES[this.id]; },
  /** Les atlas proposés (sélecteur de l'accueil, premier lancement, salons). */
  offered: OFFERED,
};
