export type Appearance = "light" | "dark";
export const appearanceStorageKey = "lens.appearance";

// Runs before the page paints. Storage can be unavailable in private/embedded contexts.
export const appearanceInitScript = `try{var t=localStorage.getItem("${appearanceStorageKey}");document.documentElement.dataset.theme=t==="dark"?"dark":"light"}catch{document.documentElement.dataset.theme="light"}`;
