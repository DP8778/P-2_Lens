import { spawn } from "node:child_process";
import { createServer } from "node:http";
import next from "next";

const app = next({ dev: false, dir: process.cwd() });
const port = Number(process.env.LENS_E2E_PORT ?? 3000);
await app.prepare();

const handle = app.getRequestHandler();
const server = createServer((request, response) => handle(request, response));

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(port, resolve);
});

const playwright = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test"], {
  cwd: process.cwd(),
  env: { ...process.env, PW_MANAGED_SERVER: "1", PW_BASE_URL: `http://localhost:${port}` },
  stdio: "inherit",
});

const exitCode = await new Promise((resolve) => playwright.once("exit", resolve));
await new Promise((resolve) => server.close(resolve));
await app.close();
process.exit(Number(exitCode ?? 1));
