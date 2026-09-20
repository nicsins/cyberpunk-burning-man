/** Thin loader — concatenates game.part*.js then imports as ES module */
const PARTS = 5;
const base = new URL('./', import.meta.url);
const texts = await Promise.all(
  Array.from({length: PARTS}, (_, i) =>
    fetch(new URL(`game.part${i}.js`, base)).then(r => {
      if (!r.ok) throw new Error(`Failed to load game.part${i}.js: ` + r.status);
      return r.text();
    })
  )
);
const code = texts.join('');
const blob = new Blob([code], { type: 'text/javascript' });
const url = URL.createObjectURL(blob);
await import(url);
