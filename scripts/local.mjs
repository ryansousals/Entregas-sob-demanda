import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const action = process.argv[2] ?? "init";

function parseEnv(text) {
  return Object.fromEntries(
    text.split(/\r?\n/).flatMap((line) => {
      const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!match) return [];
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      )
        value = value.slice(1, -1);
      return [[match[1], value]];
    }),
  );
}

function localEnvironment() {
  const envPath = resolve(root, ".env");
  const template = readFileSync(resolve(root, ".env.example"), "utf8");
  const currentText = existsSync(envPath)
    ? readFileSync(envPath, "utf8")
    : template;
  const values = { ...parseEnv(template), ...parseEnv(currentText) };
  for (const key of ["POSTGRES_PASSWORD", "JWT_SECRET"]) {
    if (!values[key] || values[key] === "GERAR_AUTOMATICAMENTE")
      values[key] = randomBytes(32).toString("hex");
  }
  for (const key of ["DB_PORT", "API_PORT", "APP_PORT"]) {
    const port = Number(process.env[key] ?? values[key]);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error(
        `${key} deve ser uma porta entre 1 e 65535 no arquivo .env.`,
      );
  }
  const missing = new Set(Object.keys(values));
  let nextText = currentText.replace(
    /^\s*([A-Z][A-Z0-9_]*)\s*=.*$/gm,
    (line, key) => {
      if (!(key in values)) return line;
      missing.delete(key);
      return `${key}=${values[key]}`;
    },
  );
  for (const key of missing) nextText += `\n${key}=${values[key]}`;
  if (!nextText.endsWith("\n")) nextText += "\n";
  if (currentText !== nextText || !existsSync(envPath))
    writeFileSync(envPath, nextText, { mode: 0o600 });
  const effective = { ...values, ...process.env };
  const auth = `${encodeURIComponent(effective.POSTGRES_USER)}:${encodeURIComponent(effective.POSTGRES_PASSWORD)}`;
  const db = encodeURIComponent(effective.POSTGRES_DB);
  // Os comandos locais sempre apontam para seu próprio PostgreSQL. Não reutilizam URLs externas.
  effective.DATABASE_URL = `postgresql://${auth}@127.0.0.1:${effective.DB_PORT}/${db}`;
  effective.DATABASE_URL_DOCKER = `postgresql://${auth}@db:5432/${db}`;
  return effective;
}

function run(command, args, { cwd = root, env = process.env } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error)
    throw new Error(
      `Não foi possível executar ${command}. Verifique se está instalado e disponível no terminal.`,
    );
  if (result.status !== 0)
    throw new Error(
      `${command} terminou com código ${result.status ?? "desconhecido"}. Consulte a mensagem acima.`,
    );
}

function compose(args, env) {
  run("docker", ["compose", ...args], { env });
}

function checkDocker(env) {
  run("docker", ["info", "--format", "{{.ServerVersion}}"], { env });
  run("docker", ["compose", "version", "--short"], { env });
}

function packageCommand(directory, args, env) {
  run(npm, args, { cwd: resolve(root, directory), env });
}

function startDevelopment(env) {
  const processes = [
    [resolve(root, "backend"), ["run", "start:dev"]],
    [resolve(root, "frontend"), ["run", "dev", "--", "--host", "127.0.0.1"]],
  ].map(([cwd, args]) =>
    spawn(npm, args, {
      cwd,
      env,
      stdio: "inherit",
      shell: process.platform === "win32",
    }),
  );
  let stopping = false;
  const stop = (code = 0) => {
    if (stopping) return;
    stopping = true;
    for (const child of processes) child.kill("SIGTERM");
    process.exitCode = code;
  };
  for (const child of processes) {
    child.on("error", (error) => {
      console.error(error.message);
      stop(1);
    });
    child.on("exit", (code) => stop(code ?? 0));
  }
  process.on("SIGINT", () => stop());
  process.on("SIGTERM", () => stop());
}

try {
  if (Number(process.versions.node.split(".")[0]) < 24)
    throw new Error("Use Node.js 24 ou mais recente.");
  const env = localEnvironment();
  switch (action) {
    case "init":
    case "start":
      checkDocker(env);
      compose(
        ["up", "--build", "--detach", "--wait", "--wait-timeout", "180"],
        env,
      );
      console.log(
        `\nEntregaJá disponível em http://localhost:${env.APP_PORT}\nOs dados ficam salvos no volume do PostgreSQL.\n`,
      );
      break;
    case "stop":
      compose(["stop"], env);
      break;
    case "logs":
      compose(["logs", "--follow", "--tail", "100"], env);
      break;
    case "status":
      compose(["ps"], env);
      break;
    case "shell":
      compose(["exec", "backend", "sh"], env);
      break;
    case "setup":
      checkDocker(env);
      compose(["up", "--detach", "--wait", "db"], env);
      packageCommand("backend", ["ci"], env);
      packageCommand("frontend", ["ci"], env);
      packageCommand("backend", ["exec", "--", "prisma", "generate"], env);
      packageCommand(
        "backend",
        ["exec", "--", "prisma", "migrate", "deploy"],
        env,
      );
      if (env.SEED_DEMO === "true")
        run(process.execPath, ["scripts/seed-demo.cjs"], {
          cwd: resolve(root, "backend"),
          env,
        });
      console.log(
        "\nConfiguração concluída. Execute npm run dev e abra http://localhost:5173.",
      );
      break;
    case "dev":
      startDevelopment({
        ...env,
        PORT: env.API_PORT,
        VITE_API_PROXY_TARGET: `http://127.0.0.1:${env.API_PORT}`,
        VITE_DEMO_MODE: env.VITE_DEMO_MODE,
      });
      break;
    case "build":
      packageCommand("backend", ["exec", "--", "prisma", "generate"], env);
      packageCommand("backend", ["run", "build"], env);
      packageCommand("frontend", ["run", "build"], {
        ...env,
        VITE_DEMO_MODE: env.VITE_DEMO_MODE,
      });
      break;
    case "test":
      packageCommand("backend", ["test", "--", "--runInBand"], env);
      run(process.execPath, ["--test", "scripts/create-admin.test.cjs"], {
        cwd: resolve(root, "backend"),
        env,
      });
      break;
    case "test:e2e":
      if (!process.env.TEST_DATABASE_URL)
        throw new Error(
          "Defina TEST_DATABASE_URL para um PostgreSQL exclusivo de testes com as migrações aplicadas.",
        );
      packageCommand("backend", ["run", "test:e2e", "--", "--runInBand"], {
        ...env,
        DATABASE_URL: process.env.TEST_DATABASE_URL,
      });
      break;
    default:
      throw new Error(`Comando desconhecido: ${action}`);
  }
} catch (error) {
  console.error(`\n${error.message}`);
  if (["init", "start", "setup"].includes(action))
    console.error(
      "Confirme que o Docker Desktop está aberto. Para detalhes: npm run local:logs",
    );
  process.exitCode = 1;
}
