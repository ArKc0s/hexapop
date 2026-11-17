// Version du jeu (définie à la compilation, voir vite.config.ts).
declare const __HEXA_VERSION__: string;
declare const __HEXA_COMMIT__: string;
declare const __HEXA_BUILT__: string;

export const VERSION = __HEXA_VERSION__;
export const COMMIT = __HEXA_COMMIT__;
export const BUILT = new Date(__HEXA_BUILT__);

/** « 1.8.0 · a3f9c21 » */
export const versionLabel = () => (COMMIT ? `${VERSION} · ${COMMIT}` : VERSION);

/** Signaler un bug : formulaire GitHub avec la version déjà remplie. */
export const bugUrl = () => `https://github.com/ArKc0s/hexapop/issues/new?template=bug.yml&version=${encodeURIComponent(versionLabel())}`;
