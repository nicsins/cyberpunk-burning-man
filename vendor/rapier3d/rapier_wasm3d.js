// Kiln: browser loader for the non-compat build (no bundler): instantiate the .wasm next to this file.
import * as bg from "./rapier_wasm3d_bg.js";
import { __wbg_set_wasm } from "./rapier_wasm3d_bg.js";
const url = new URL("./rapier_wasm3d_bg.wasm", import.meta.url);
const resp = await fetch(url);
const { instance } = WebAssembly.instantiateStreaming && (resp.headers.get('content-type')||'').includes('wasm')
  ? await WebAssembly.instantiateStreaming(resp, { "./rapier_wasm3d_bg.js": bg })
  : await WebAssembly.instantiate(await resp.arrayBuffer(), { "./rapier_wasm3d_bg.js": bg });
__wbg_set_wasm(instance.exports);
if (instance.exports.__wbindgen_start) instance.exports.__wbindgen_start();
export * from "./rapier_wasm3d_bg.js";
