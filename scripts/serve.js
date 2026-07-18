const { spawn } = require("child_process");
const http = require("http");

// Start Next.js dev server
const server = spawn("node", ["node_modules/.bin/next", "dev", "-p", "3000"], {
  cwd: __dirname + "/..",
  stdio: ["ignore", "ignore", "ignore"],
  detached: false,
});

// Keepalive: self-ping every 8 seconds to prevent idle kill
setInterval(() => {
  const req = http.get("http://localhost:3000/", (res) => {
    res.resume();
  });
  req.on("error", () => {});
  req.setTimeout(3000, () => req.destroy());
}, 8000);

server.on("exit", (code) => {
  process.exit(code || 1);
});

process.on("SIGTERM", () => { server.kill(); process.exit(0); });
process.on("SIGINT", () => { server.kill(); process.exit(0); });