import { mount } from "svelte";
// Polices auto-hébergées (aucune requête vers Google : pas de transfert d'IP à un tiers).
import "@fontsource/bowlby-one/latin-400.css";
import "@fontsource/gabarito/latin-500.css";
import "@fontsource/gabarito/latin-600.css";
import "@fontsource/gabarito/latin-700.css";
import "@fontsource/gabarito/latin-800.css";
import "@fontsource/gabarito/latin-900.css";
import "./lib/theme.css";
import App from "./App.svelte";

mount(App, { target: document.getElementById("app")! });
