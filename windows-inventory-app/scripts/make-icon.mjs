// One-off icon generator: rasterizes resources/icon-source.svg into the
// sizes Windows expects and packs them into resources/icon.ico. Run once
// with `node scripts/make-icon.mjs` — sharp/to-ico are only needed for this
// script, not by the shipped app, so they aren't in package.json.
import sharp from "sharp";
import toIco from "to-ico";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, "..", "resources", "icon-source.svg");
const icoPath = path.join(__dirname, "..", "resources", "icon.ico");
const pngPath = path.join(__dirname, "..", "resources", "icon.png");

const sizes = [16, 24, 32, 48, 64, 128, 256];

const svg = fs.readFileSync(svgPath);
const pngBuffers = await Promise.all(
  sizes.map((size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer())
);

const ico = await toIco(pngBuffers);
fs.writeFileSync(icoPath, ico);

// Also keep a 512px PNG around for any future non-Windows packaging needs.
const bigPng = await sharp(svg, { density: 384 }).resize(512, 512).png().toBuffer();
fs.writeFileSync(pngPath, bigPng);

console.log("Wrote", icoPath, `(${ico.length} bytes)`);
console.log("Wrote", pngPath, `(${bigPng.length} bytes)`);
