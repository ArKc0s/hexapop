<script lang="ts">
  export type IconName = "flame" | "play" | "lock" | "star" | "check" | "cross" | "pin" | "sound" | "mute" | "trophy" | "gear";
  let { name, size = 18 }: { name: IconName; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" class="ic">
  {#if name === "flame"}<path d="M10 1c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4.5 2-7.5 2 1 3 3 3 5 1-2 1-5 1-8.5z" fill="#f76707" />
  {:else if name === "play"}<path d="M6 3.5l10 6.5-10 6.5z" fill="currentColor" />
  {:else if name === "lock"}<path d="M6 9V6.5a4 4 0 0 1 8 0V9" fill="none" stroke="currentColor" stroke-width="2" /><rect x="4" y="9" width="12" height="9" rx="2.5" fill="currentColor" />
  {:else if name === "star"}<path d="M10 1.5l2.4 5.3 5.8.6-4.4 3.9 1.3 5.7L10 14.1l-5.1 2.9 1.3-5.7L1.8 7.4l5.8-.6z" fill="var(--yellow)" stroke="var(--yellow-d)" stroke-width="1" />
  {:else if name === "check"}<path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
  {:else if name === "cross"}<path d="M5.5 5.5l9 9M14.5 5.5l-9 9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
  {:else if name === "gear"}<path fill-rule="evenodd" fill="currentColor" d="M8.6 1.5h2.8l.5 2.3 1.6.7 2-1.3 2 2-1.3 2 .7 1.6 2.3.5v2.8l-2.3.5-.7 1.6 1.3 2-2 2-2-1.3-1.6.7-.5 2.3H8.6l-.5-2.3-1.6-.7-2 1.3-2-2 1.3-2-.7-1.6-2.3-.5V8.6l2.3-.5.7-1.6-1.3-2 2-2 2 1.3 1.6-.7zM10 6.9a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 1 0 0-6.2z" />
  {:else if name === "pin"}<path d="M10 18.5s-5.5-5.6-5.5-9.8a5.5 5.5 0 0 1 11 0c0 4.2-5.5 9.8-5.5 9.8z" fill="currentColor" /><circle cx="10" cy="8.6" r="2.1" fill="#fff" />
  {:else if name === "sound"}<path d="M3 7.5h3l4-3.5v12l-4-3.5H3z" fill="currentColor" /><path d="M13 7a4 4 0 0 1 0 6M15 4.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
  {:else if name === "mute"}<path d="M3 7.5h3l4-3.5v12l-4-3.5H3z" fill="currentColor" /><path d="M13 7.5l5 5M18 7.5l-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
  {:else if name === "trophy"}<path d="M6 3h8v4a4 4 0 0 1-8 0zM6 4H3v1.5A3 3 0 0 0 6 8.5M14 4h3v1.5A3 3 0 0 1 14 8.5M10 11v3M7 17h6l-1-3H8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
  {/if}
</svg>

<style>.ic { flex: none; display: inline-block; vertical-align: -3px; }</style>
