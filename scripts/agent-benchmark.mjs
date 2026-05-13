import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const backendDir = path.join(rootDir, "backend");
const reportPath = path.join(backendDir, "target", "surefire-reports", "TEST-com.xiaobao.babycompanion.agent.AgentBenchmarkTests.xml");
const resultDocPath = path.join(rootDir, "docs", "agent-benchmark-results.md");

function existsExecutable(filePath) {
  return filePath && fs.existsSync(filePath);
}

function resolveMaven() {
  const candidates = [
    { value: process.env.MAVEN_BIN, mustExist: true },
    { value: path.join(rootDir, "mvnw"), mustExist: true },
    { value: "/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn", mustExist: true },
    { value: "mvn", mustExist: false },
  ];
  return candidates
    .filter((candidate) => candidate.value)
    .find((candidate) => !candidate.mustExist || existsExecutable(candidate.value))
    ?.value;
}

function resolveJavaHome() {
  const candidates = [
    process.env.JAVA_HOME,
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
    "/Applications/IntelliJ IDEA.app/Contents/jbr/Contents/Home",
  ];
  return candidates.find((candidate) => candidate && existsExecutable(path.join(candidate, "bin", "java")));
}

function xmlAttr(text, name) {
  const match = text.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : "";
}

function parseReport(xml) {
  const suiteTag = xml.match(/<testsuite\b([^>]*)>/)?.[1] || "";
  const cases = [];
  const caseRegex = /<testcase\b([^>]*)>([\s\S]*?)<\/testcase>|<testcase\b([^>]*)\/>/g;
  let match;
  while ((match = caseRegex.exec(xml)) !== null) {
    const attrs = match[1] || match[3] || "";
    const body = match[2] || "";
    let status = "PASS";
    if (body.includes("<failure")) status = "FAIL";
    else if (body.includes("<error")) status = "ERROR";
    else if (body.includes("<skipped")) status = "SKIP";
    cases.push({
      name: xmlAttr(attrs, "name"),
      time: xmlAttr(attrs, "time"),
      status,
    });
  }
  return {
    tests: Number(xmlAttr(suiteTag, "tests") || 0),
    failures: Number(xmlAttr(suiteTag, "failures") || 0),
    errors: Number(xmlAttr(suiteTag, "errors") || 0),
    skipped: Number(xmlAttr(suiteTag, "skipped") || 0),
    time: xmlAttr(suiteTag, "time") || "0",
    cases,
  };
}

function writeResultDoc(summary, command, exitCode) {
  const generatedAt = new Date().toISOString();
  const lines = [
    "# Agent Benchmark Results",
    "",
    `Generated at: ${generatedAt}`,
    "",
    "## Command",
    "",
    "```bash",
    command,
    "```",
    "",
    "## Summary",
    "",
    `- Status: ${exitCode === 0 && summary.failures === 0 && summary.errors === 0 ? "PASS" : "FAIL"}`,
    `- Tests: ${summary.tests}`,
    `- Failures: ${summary.failures}`,
    `- Errors: ${summary.errors}`,
    `- Skipped: ${summary.skipped}`,
    `- Time: ${summary.time}s`,
    "",
    "## Cases",
    "",
    ...summary.cases.map((testCase) => `- ${testCase.status} \`${testCase.name}\` (${testCase.time}s)`),
    "",
  ];
  fs.mkdirSync(path.dirname(resultDocPath), { recursive: true });
  fs.writeFileSync(resultDocPath, `${lines.join("\n")}\n`);
}

const mavenBin = resolveMaven();
const javaHome = resolveJavaHome();
const env = { ...process.env };
if (javaHome) {
  env.JAVA_HOME = javaHome;
  env.PATH = `${path.join(javaHome, "bin")}${path.delimiter}${env.PATH || ""}`;
}

const args = ["-Dtest=AgentBenchmarkTests", "test", "-q"];
const command = `${mavenBin.includes(" ") ? `"${mavenBin}"` : mavenBin} ${args.join(" ")}`;
console.log(`Running agent benchmark: ${command}`);
if (javaHome) console.log(`Using JAVA_HOME=${javaHome}`);

const result = spawnSync(mavenBin, args, {
  cwd: backendDir,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

let summary = {
  tests: 0,
  failures: 0,
  errors: 1,
  skipped: 0,
  time: "0",
  cases: [],
};
if (fs.existsSync(reportPath)) {
  summary = parseReport(fs.readFileSync(reportPath, "utf8"));
}
writeResultDoc(summary, "npm run test:agent-benchmark", result.status ?? 1);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
