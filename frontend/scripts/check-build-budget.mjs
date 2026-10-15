import { readdir, readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const assetsDir = path.resolve('dist/assets');
const JS_GZIP_LIMIT = 380 * 1024;
const CSS_GZIP_LIMIT = 120 * 1024;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

const files = (await walk(assetsDir)).filter((file) => /\.(js|css)$/.test(file));
const rows = [];

for (const file of files) {
  const buffer = await readFile(file);
  const info = await stat(file);
  rows.push({
    file: path.relative(path.resolve('dist'), file),
    bytes: info.size,
    gzipBytes: gzipSync(buffer, { level: 9 }).byteLength,
    type: path.extname(file).slice(1)
  });
}

rows.sort((a, b) => b.gzipBytes - a.gzipBytes);
console.log('\nPerformance V3 build budget (largest gzip assets)');
for (const row of rows.slice(0, 12)) {
  console.log(`${String(Math.round(row.gzipBytes / 1024)).padStart(4)} KiB gzip  ${row.file}`);
}

const failures = rows.filter((row) => {
  if (row.type === 'js') return row.gzipBytes > JS_GZIP_LIMIT;
  if (row.type === 'css') return row.gzipBytes > CSS_GZIP_LIMIT;
  return false;
});

if (failures.length) {
  console.error('\nPerformance budget exceeded:');
  failures.forEach((row) => {
    const limit = row.type === 'js' ? JS_GZIP_LIMIT : CSS_GZIP_LIMIT;
    console.error(`- ${row.file}: ${Math.round(row.gzipBytes / 1024)} KiB gzip > ${Math.round(limit / 1024)} KiB`);
  });
  process.exit(1);
}

console.log(`\nOK: JS <= ${JS_GZIP_LIMIT / 1024} KiB gzip, CSS <= ${CSS_GZIP_LIMIT / 1024} KiB gzip.`);
