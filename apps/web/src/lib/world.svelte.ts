// L'atlas affiché (un atlas = un monde, docs/atlas.md) : celui du profil, départements par défaut.
import { ATLASES, type Atlas, type AtlasId } from "@hexa/game";
import { profile } from "./profile.svelte.ts";

export const world = {
  get id(): AtlasId { return profile.data.atlas ?? "france"; },
  get atlas(): Atlas { return ATLASES[this.id]; },
};
