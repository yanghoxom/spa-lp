// Shared, decorative UI icons. These are vector markup, not standalone media assets.
// Keep labels in the surrounding controls; icons inherit the foreground color.
const paths = Object.freeze({
  "arrow-right": '<path d="M5 12h14M12 5l7 7-7 7"/>',
  "arrow-left": '<path d="M19 12H5m7 7-7-7 7-7"/>',
  "arrow-down": '<path d="M12 5v14m-7-7 7 7 7-7"/>',
  "external-link": '<path d="M13 5h6v6m0-6-9 9"/><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  "menu": '<path d="M4 6h16M4 12h16M4 18h16"/>',
  "close": '<path d="m6 6 12 12M18 6 6 18"/>',
  "sparkle": '<path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8m0-12.8L5.6 18.4"/>',
});

export function uiIcon(name) {
  if (!Object.hasOwn(paths, name)) throw new Error("Unknown UI icon: " + name);
  return '<svg xmlns="http://www.w3.org/2000/svg" class="ui-icon ui-icon--' + name +
    '" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    paths[name] + '</svg>';
}
