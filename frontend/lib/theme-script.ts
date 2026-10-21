// Shared by the server layout (boot script) and the client theme store. No React imports here.

export const THEME_STORAGE_KEY = 'pg-selector-theme';

/** Runs before the page paints (inlined in <head>) so a stored dark choice never flashes light. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;
