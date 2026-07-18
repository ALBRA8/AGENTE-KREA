const { spawn } = require("child_process");
const http = require("http");

function start() {
  const server = spawn("node", ["node_modules/.bin/next", "dev", "-p", "3000"], {
    cwd: __dirname + "/..",
    stdio: ["ignore", "ignore", "ignore"],
  });

  // Aggressive keepalive every 3 seconds
  const timer = setInterval(() => {
    try {
      const req = http.get("http://localhost:3000/", (res) => {
        res.resume();
      });
      req.on("error", () => {});
      req.setTimeout(2000, () => req.destroy());
    } catch {}
  }, 3000);

  server.on("exit", () => {
    clearInterval(timer);
    // Auto-restart after 1 second
    setTimeout(start, 1000);
  });

  process.on("SIGTERM", () => { clearInterval(timer); server.kill(); process.exit(0); });
  process.on("SIGINT", () => { clearInterval(timer); server.kill(); process.exit(0); });
}

start();