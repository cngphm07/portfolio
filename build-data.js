// One-off generator: writes data.js from a fresh Drive scan.
// The website kept in sync automatically uses server.js instead.
const fs = require("fs");
const { scanAll } = require("./drive-scan");

scanAll().then(data => {
  fs.writeFileSync("data.js", "const PORTFOLIO_DATA = " + JSON.stringify(data, null, 2) + ";");
  const count = a => Array.isArray(a) ? a.length : Object.values(a).reduce((s, x) => s + x.length, 0);
  console.log("data.js written:", Object.entries(data).map(([k, v]) => `${k}:${count(v)}`).join(", "), "| total", Object.values(data).reduce((s, v) => s + count(v), 0));
});
