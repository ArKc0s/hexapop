<script lang="ts">
  import { nav } from "../lib/nav.svelte.ts";
  import Mascot from "../lib/ui/Mascot.svelte";
  import RemindersPanel from "../lib/ui/RemindersPanel.svelte";
</script>

<main class="rm">
  <button class="back" onclick={() => nav.go({ name: "home" })}>← Accueil</button>
  <div class="head"><Mascot mood="happy" size={56} /><h1 class="title">Rappels</h1></div>
  <RemindersPanel />
</main>

<style>
  .rm { max-width: 560px; margin: 0 auto; padding: 20px 20px 48px; display: flex; flex-direction: column; gap: 14px; }
  .back { align-self: flex-start; }
  .head { display: flex; gap: 12px; align-items: center; }
</style>
