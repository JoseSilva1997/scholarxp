// Aggregates Jest's Istanbul coverage JSON into ScholarXP backend domain folders.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');
const coveragePath = path.resolve(backendRoot, 'coverage/coverage-final.json');

const metricNames = ['statements', 'branches', 'functions', 'lines'];

const createMetric = () => ({ covered: 0, total: 0 });

const createSummary = () =>
  Object.fromEntries(metricNames.map((name) => [name, createMetric()]));

const addMetric = (target, source) => {
  target.covered += source.covered;
  target.total += source.total;
};

const countHitMap = (hitMap) => {
  const values = Object.values(hitMap ?? {});

  return {
    covered: values.filter((hits) => hits > 0).length,
    total: values.length,
  };
};

const countBranchMap = (branchHits) => {
  const branches = Object.values(branchHits ?? {}).flat();

  return {
    covered: branches.filter((hits) => hits > 0).length,
    total: branches.length,
  };
};

const countLineMap = (statementMap, statementHits) => {
  const lines = new Map();

  for (const [statementId, location] of Object.entries(statementMap ?? {})) {
    const line = location?.start?.line;

    if (!line) {
      continue;
    }

    const hits = statementHits?.[statementId] ?? 0;
    lines.set(line, Math.max(lines.get(line) ?? 0, hits));
  }

  const values = [...lines.values()];

  return {
    covered: values.filter((hits) => hits > 0).length,
    total: values.length,
  };
};

const summarizeFile = (coverage) => ({
  statements: countHitMap(coverage.s),
  branches: countBranchMap(coverage.b),
  functions: countHitMap(coverage.f),
  lines: countLineMap(coverage.statementMap, coverage.s),
});

const hasCoverableCode = (summary) =>
  metricNames.some((metricName) => summary[metricName].total > 0);

const addSummary = (target, source) => {
  for (const metricName of metricNames) {
    addMetric(target[metricName], source[metricName]);
  }
};

const getDomainName = (filePath) => {
  const relativePath = path.relative(backendRoot, filePath).split(path.sep).join('/');

  if (!relativePath.startsWith('src/')) {
    return null;
  }

  const [, domainName, nestedPath] = relativePath.split('/');

  return nestedPath ? domainName : 'src';
};

const percentage = ({ covered, total }) => {
  if (total === 0) {
    return 100;
  }

  return (covered / total) * 100;
};

const formatPercent = (metric) => `${percentage(metric).toFixed(2)}%`;

const formatRatio = ({ covered, total }) => `${covered}/${total}`;

const pad = (value, width) => value.padEnd(width, ' ');

const readCoverage = async () => {
  try {
    return JSON.parse(await readFile(coveragePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(
        'Coverage data not found. Run `pnpm --filter backend test:cov` first.',
      );
      process.exit(1);
    }

    throw error;
  }
};

const coverage = await readCoverage();
const domains = new Map();
const total = createSummary();

for (const [filePath, fileCoverage] of Object.entries(coverage)) {
  const domainName = getDomainName(filePath);

  if (!domainName) {
    continue;
  }

  const fileSummary = summarizeFile(fileCoverage);

  if (!hasCoverableCode(fileSummary)) {
    continue;
  }

  if (!domains.has(domainName)) {
    domains.set(domainName, createSummary());
  }

  addSummary(domains.get(domainName), fileSummary);
  addSummary(total, fileSummary);
}

const rows = [...domains.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([domainName, summary]) => ({ domainName, summary }));

if (rows.length === 0) {
  console.error('No src coverage entries were found in coverage-final.json.');
  process.exit(1);
}

const tableRows = [
  ['Domain', 'Statements', 'Branches', 'Functions', 'Lines'],
  ...rows.map(({ domainName, summary }) => [
    domainName,
    `${formatPercent(summary.statements)} (${formatRatio(summary.statements)})`,
    `${formatPercent(summary.branches)} (${formatRatio(summary.branches)})`,
    `${formatPercent(summary.functions)} (${formatRatio(summary.functions)})`,
    `${formatPercent(summary.lines)} (${formatRatio(summary.lines)})`,
  ]),
  [
    'Total',
    `${formatPercent(total.statements)} (${formatRatio(total.statements)})`,
    `${formatPercent(total.branches)} (${formatRatio(total.branches)})`,
    `${formatPercent(total.functions)} (${formatRatio(total.functions)})`,
    `${formatPercent(total.lines)} (${formatRatio(total.lines)})`,
  ],
];

const columnWidths = tableRows[0].map((_, index) =>
  Math.max(...tableRows.map((row) => row[index].length)),
);

console.log('\nBackend coverage by domain\n');

for (const [index, row] of tableRows.entries()) {
  console.log(row.map((value, columnIndex) => pad(value, columnWidths[columnIndex])).join('  '));

  if (index === 0) {
    console.log(columnWidths.map((width) => '-'.repeat(width)).join('  '));
  }
}
