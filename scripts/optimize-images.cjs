// Deterministic resize/format conversion. Originals are never overwritten.
// Requires sharp. With the bundled runtime, set NODE_PATH to its node_modules.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

async function main() {
  const root = path.resolve(__dirname, '..');
  const config = JSON.parse(await fs.readFile(path.join(root, process.argv[2] || 'config/import/blue-archive.json'), 'utf8'));
  const report = JSON.parse(await fs.readFile(path.join(root, 'data/reports/source-audit.json'), 'utf8'));
  const output = path.join(root, 'data/processed', config.game.slug);
  const manifest = [];
  const background = {r: 243, g: 245, b: 249, alpha: 1};
  for (const kind of ['stories', 'characters']) {
    const files = report.images.filter(x => x.path.startsWith(config.imageDirectories[kind] + '/'));
    const seen = new Set();
    for (const input of files) {
      if (input.error) throw new Error(`Unreadable source: ${input.path}`);
      if (input.frames > 1) throw new Error(`Animated source needs explicit handling: ${input.path}`);
      if (seen.has(input.stem)) throw new Error(`Duplicate image ID: ${input.stem}`);
      seen.add(input.stem);
      const source = await fs.readFile(path.join(root, input.path));
      if (crypto.createHash('sha256').update(source).digest('hex') !== input.sha256) {
        throw new Error(`Source changed since audit: ${input.path}`);
      }
      const variants = kind === 'stories' ? [['card',640,450], ['detail',1280,900]] : [['avatar',128,128], ['portrait',512,512]];
      const entry = {id: input.stem, kind, source: input.path, sourceBytes: input.bytes, sha256: input.sha256, variants: []};
      for (const [variant, width, height] of variants) {
        const inner = await sharp(source).rotate().resize({width, height, fit: 'inside', withoutEnlargement: true}).toBuffer({resolveWithObject: true});
        const file = path.join(output, kind, `${input.stem}-${variant}.webp`);
        await fs.mkdir(path.dirname(file), {recursive: true});
        await sharp({create: {width, height, channels: 4, background}})
          .composite([{input: inner.data, gravity: 'centre'}])
          .webp({quality: 82, effort: 5}).toFile(file);
        const metadata = await sharp(file).metadata();
        if (metadata.width !== width || metadata.height !== height || metadata.format !== 'webp') throw new Error(`Invalid output ${file}`);
        entry.variants.push({name: variant, path: path.relative(root, file).replaceAll('\\', '/'), width, height,
          contentWidth: inner.info.width, contentHeight: inner.info.height, bytes: (await fs.stat(file)).size});
      }
      manifest.push(entry);
    }
    console.log(`${kind}: ${files.length} sources optimized`);
  }
  const result = {game: config.game.slug, quality: 82, fit: 'contain-no-upscale', manifest};
  await fs.mkdir(output, {recursive: true});
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(result, null, 2));
  const totals = {};
  for (const kind of ['stories', 'characters']) {
    const entries = manifest.filter(x => x.kind === kind);
    totals[kind] = {count: entries.length, sourceBytes: entries.reduce((n,x) => n+x.sourceBytes,0),
      variants: entries.flatMap(x=>x.variants).reduce((a,x)=>(a[x.name]=(a[x.name]||0)+x.bytes,a),{})};
  }
  console.log(JSON.stringify(totals, null, 2));
}
main().catch(error => {console.error(error); process.exitCode = 1;});
