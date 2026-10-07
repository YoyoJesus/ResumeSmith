import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sourcePath = process.argv[2];
if (!sourcePath) {
	console.error('Usage: node scripts/build-institutions.mjs <source-json-path>');
	process.exit(1);
}

const raw = JSON.parse(readFileSync(sourcePath, 'utf8'));
const names = new Set();
for (const item of raw) {
	if (item && typeof item.name === 'string') {
		const trimmed = item.name.trim();
		if (trimmed.length > 0) {
			names.add(trimmed);
		}
	}
}

const sorted = Array.from(names).sort((a, b) => a.localeCompare(b));
const outputPath = resolve(import.meta.dirname, '../static/institutions.json');
writeFileSync(outputPath, JSON.stringify(sorted) + '\n');
console.log(`Wrote ${sorted.length} institutions to ${outputPath}`);
