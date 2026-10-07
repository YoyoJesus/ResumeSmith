import { createReadStream, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';

const sourceDir = process.argv[2];
if (!sourceDir) {
	console.error('Usage: node scripts/build-locations.mjs <geonames-source-dir>');
	process.exit(1);
}

const nonUSThreshold = parseInt(process.env.NON_US_POP_THRESHOLD || '100000', 10);

async function run() {
	const countryInfoPath = resolve(sourceDir, 'countryInfo.txt');
	const countryLines = readFileSync(countryInfoPath, 'utf8').split('\n');
	const countryNames = new Map();
	for (const line of countryLines) {
		if (!line || line.startsWith('#')) continue;
		const parts = line.split('\t');
		const code = parts[0]?.trim();
		const countryName = parts[4]?.trim();
		if (code && countryName) {
			countryNames.set(code, countryName);
		}
	}

	const candidates = [];

	const cities5000Path = resolve(sourceDir, 'cities5000.txt');
	const rlUS = createInterface({
		input: createReadStream(cities5000Path),
		crlfDelay: Infinity,
	});

	for await (const line of rlUS) {
		if (!line) continue;
		const parts = line.split('\t');
		if (parts.length < 15) continue;
		const countryCode = parts[8];
		if (countryCode === 'US') {
			const name = parts[1]?.trim();
			const state = parts[10]?.trim();
			const population = parseInt(parts[14] || '0', 10);
			if (name && state) {
				candidates.push({
					display: `${name}, ${state}`,
					population,
				});
			}
		}
	}

	const cities15000Path = resolve(sourceDir, 'cities15000.txt');
	const rlWorld = createInterface({
		input: createReadStream(cities15000Path),
		crlfDelay: Infinity,
	});

	for await (const line of rlWorld) {
		if (!line) continue;
		const parts = line.split('\t');
		if (parts.length < 15) continue;
		const countryCode = parts[8];
		if (countryCode !== 'US') {
			const population = parseInt(parts[14] || '0', 10);
			if (population >= nonUSThreshold) {
				const name = parts[1]?.trim();
				const countryName = countryNames.get(countryCode);
				if (name && countryName) {
					candidates.push({
						display: `${name}, ${countryName}`,
						population,
					});
				}
			}
		}
	}

	candidates.sort((a, b) => b.population - a.population);

	const seen = new Set();
	const deduplicated = [];
	for (const item of candidates) {
		if (!seen.has(item.display)) {
			seen.add(item.display);
			deduplicated.push(item.display);
		}
	}

	const outputPath = resolve(import.meta.dirname, '../static/locations.json');
	const content = JSON.stringify(deduplicated) + '\n';
	writeFileSync(outputPath, content, 'utf8');

	const byteSize = Buffer.byteLength(content, 'utf8');
	console.log(`Wrote ${deduplicated.length} locations to ${outputPath} (${byteSize} bytes)`);
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
