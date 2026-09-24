// 軽量なインラインSVG。外部画像の読み込みを必要としない。
const shapes={
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 record:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M12 16v3m-1.5-1.5h3"/>',
 events:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h3m2 0h3m-8 4h3"/>',
 decks:'<rect x="6" y="3" width="14" height="18" rx="2"/><path d="M4 6H3v14a1 1 0 0 0 1 1h12M9 7h8m-8 4h8m-8 4h5"/>',
 community:'<circle cx="12" cy="7" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2M3 5l2 1m14-1 2 1"/>',
 analysis:'<path d="M4 20V11m5 9V5m5 15v-7m5 7V9M2 21h20"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M10 2h4l.6 2.4 2.1.9 2.1-1.3 2.8 2.8-1.3 2.1.9 2.1 2.4.6v4l-2.4.6-.9 2.1 1.3 2.1-2.8 2.8-2.1-1.3-2.1.9L14 22h-4l-.6-2.4-2.1-.9-2.1 1.3-2.8-2.8 1.3-2.1-.9-2.1L.4 14v-4l2.4-.6.9-2.1-1.3-2.1 2.8-2.8 2.1 1.3 2.1-.9z"/>',
 monster:'<path d="m12 3 2.5 5.8 6.5.6-4.9 4.2 1.5 6.4-5.6-3.4-5.6 3.4 1.5-6.4L3 9.4l6.5-.6z"/>',
 spell:'<path d="m13 2-8 11h6l-1 9 9-12h-6z"/>',
 trap:'<path d="M12 2 4 5v6c0 5 3.4 8.6 8 11 4.6-2.4 8-6 8-11V5zM9 11l2 2 4-4"/>',
 unknown:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 3.7 2.2c-1 .6-1.3 1-1.3 2.3m0 3h.01"/>'
};
export const icon=(name)=>`<svg class="icon icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[name]||shapes.unknown}</svg>`;
