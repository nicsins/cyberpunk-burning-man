/**
 * Cyberpunk Burning Man — inflate full polished monolithic game (sprites, auto-pickup, Ctrl-drop, NPC talk, pointer-lock).
 * Payload halves are the gzip+base64 of the complete game source (not an old CDN patch).
 */
const a = await (await fetch(new URL('./game.payload.a.txt', import.meta.url))).text();
const b = await (await fetch(new URL('./game.payload.b.txt', import.meta.url))).text();
const bin = atob(a + b);
const bytes = new Uint8Array(bin.length);
for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
const code = await new Response(stream).text();
await import(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
