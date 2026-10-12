declare const __APP_VERSION__: string;

/** Game version from package.json (shown in the menu, HUD and guide). */
export const VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
