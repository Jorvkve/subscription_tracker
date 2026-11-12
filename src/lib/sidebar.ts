// Cookie that remembers whether the desktop sidebar is collapsed. Kept outside the client
// component file: a constant exported from a "use client" module reaches the server as a
// client reference, not as the string.
export const SIDEBAR_COOKIE = "subtrack-sidebar";
