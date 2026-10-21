// Shared by the server layout (boot script) and the client theme store. No React imports here.

export const THEME_STORAGE_KEY = 'pg-selector-theme';

/** Runs before the page paints (inlined in <head>): dark unless "light" was chosen, so the page never flashes. */
export const THEME_BOOT_SCRIPT = `try{document.documentElement.dataset.theme=localStorage.getItem('${THEME_STORAGE_KEY}')==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}`;
