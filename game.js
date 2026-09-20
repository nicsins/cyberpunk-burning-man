/**
 * Cyberpunk Burning Man — inflate full polished monolithic game
 * (sprites, auto-pickup, Ctrl-drop, NPC proximity talk, pointer-lock resume).
 * Payload chunks are gzip+base64 of the complete game (not an old CDN patch).
 */
async function loadParts(prefix, n) {
  let s = '';
  for (let i = 0; i < n; i++) {
    s += await (await fetch(new URL(`./${prefix}.${i}.txt`, import.meta.url))).text();
  }
  return s.trim();
}
const a = await loadParts('game.payload.a', 4);
const b = await loadParts('game.payload.b', 4);
const bin = atob(a + b);
const bytes = new Uint8Array(bin.length);
for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
const code = await new Response(stream).text();
await import(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
