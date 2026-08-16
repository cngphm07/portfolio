// Portfolio server: serves the site and auto-syncs video list with Google Drive.
// Usage:  node server.js   ->  open http://localhost:8080
// The Drive listing refreshes on startup and then every SYNC_MINUTES (default 30).
const http = require("http");
const fs = require("fs");
const path = require("path");
const { scanAll } = require("./drive-scan");

const PORT = process.env.PORT || 8080;
const SYNC_MINUTES = Number(process.env.SYNC_MINUTES || 30);

let dataJs = "";
let lastSync = null;

async function sync() {
  try {
    const data = await scanAll();
    const total = Object.values(data).reduce((s, a) => s + a.length, 0);
    dataJs = "const PORTFOLIO_DATA = " + JSON.stringify(data) + ";";
    lastSync = new Date();
    // also persist so index.html works offline via the static file
    fs.writeFileSync(path.join(__dirname, "data.js"), "const PORTFOLIO_DATA = " + JSON.stringify(data, null, 2) + ";");
    console.log(`[sync] ${lastSync.toLocaleTimeString()} — ${total} videos across ${Object.keys(data).length} categories`);
  } catch (e) {
    console.error("[sync] failed:", e.message);
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  if (req.url === "/data.js" && dataJs) {
    res.writeHead(200, { "Content-Type": MIME[".js"], "Cache-Control": "no-store" });
    return res.end(dataJs);
  }
  let file = req.url.split("?")[0];
  if (file === "/") file = "/index.html";
  const fp = path.join(__dirname, path.normalize(file));
  if (!fp.startsWith(__dirname) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.writeHead(404);
    return res.end("Not found");
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream" });
  fs.createReadStream(fp).pipe(res);
});

sync().then(() => {
  setInterval(sync, SYNC_MINUTES * 60 * 1000);
  server.listen(PORT, () => {
    console.log(`Portfolio running at http://localhost:${PORT} (Drive sync every ${SYNC_MINUTES} min)`);
  });
});
