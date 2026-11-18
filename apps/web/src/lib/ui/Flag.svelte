<script lang="ts">
  // Drapeau d'un pays (atlas Monde) : fichier SVG 4:3 de flag-icons (licence MIT), chargé à la demande.
  import { flagUrl } from "@hexa/game";
  let { code, h = 36, label }: { code: string; h?: number; label?: string } = $props();
</script>

<img class="flag" src={flagUrl(code)} alt={label ?? ""} height={h} width={Math.round((h * 4) / 3)} loading="lazy" decoding="async" draggable="false" />

<style>
  /* Liseré discret : les drapeaux à fond blanc (Japon, Chypre…) ne se perdent pas sur la carte blanche. */
  .flag { display: block; border-radius: 4px; box-shadow: 0 0 0 1px rgba(28, 26, 55, .18); object-fit: cover; background: #fff; }
</style>
