// Shared Drive scanning logic used by both build-data.js and server.js
const FOLDERS = {
  "Animation Film": "1yEraPbAtP8aQaekiq6cF6Fjxq7log1Sd",
  "Architecture Video": "1E89Ifl6K3kjlqhK2t_E7cQwHShOJ6XKW",
  "Corporate Film": "1WU45wvJYdSNDIepJq-7hWXY6hLC-Zj1F",
  "Documentary Film": "1nLKpfJwpNn7niHKqJpdw1pYr9MxBuNvm",
  "Event": "1G_2ufnr2DcDTnLLtA82dP0q9eTt4qdTK",
  "Music Video": "1dpelQyaBYSDo_5BzHi8r2VNkFv6zUnlE",
  "Podcast": "1X2hUjJycCPYwKpRG3A9gcdFUgdNCVxi9",
  "Short Film": "1NxUUIlGlgM8f4Y16GM-F008Ilbimgwli",
  "Social Video": "1iSHrAiAfRTnZFbr7FDGxfZ_Bp4aERkZB",
  "Spa": "1jkjkn-6IXsVX2vALd5X1NVLOMXkRmiIV",
  "TVC": "1sB1XiPgNPd09J1sotBL2tfpGoQ2r46Ht",
  "Wedding": "1uQvNFH_gpHdGH6aPCDX_ggB2zyatBNnY",
};

const SAIGONTOURIST_ROOT = "1SyHI868_X9sloaWt1uO8peNQINB1RCam";

async function fetchEntries(folderId) {
  const res = await fetch("https://drive.google.com/embeddedfolderview?id=" + folderId);
  if (!res.ok) throw new Error("HTTP " + res.status + " for folder " + folderId);
  const html = await res.text();
  return html.split('<div class="flip-entry"').slice(1).map(b => ({
    id: (b.match(/id="entry-([A-Za-z0-9_-]{15,})"/) || [])[1] || "",
    name: ((b.match(/flip-entry-title">([^<]+)</) || [])[1] || "").trim(),
    thumb: (b.match(/<img src="(https:\/\/lh3[^"]+)" alt="Video"/) || [])[1] || "",
    isFolder: /folders\//.test(b),
  })).filter(i => i.id);
}

async function scanFolderRecursive(folderId) {
  let vids = [];
  for (const e of await fetchEntries(folderId)) {
    if (e.isFolder) vids = vids.concat(await scanFolderRecursive(e.id));
    else if (/\.(mp4|mov|webm|mkv)$/i.test(e.name)) vids.push(e);
  }
  return vids;
}

function cleanName(n) {
  return n
    .replace(/\.(mp4|mov|webm|mkv)$/i, "")
    .replace(/_1080p$/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

async function scanAll() {
  const out = {};
  for (const [name, id] of Object.entries(FOLDERS)) {
    try {
      const entries = await fetchEntries(id);
      out[name] = entries.filter(i => !i.isFolder && /\.(mp4|mov|webm|mkv)$/i.test(i.name));
    } catch (e) {
      console.error("[scan] " + name + ": " + e.message);
      out[name] = [];
    }
  }
  try {
    const sgtr = await scanFolderRecursive(SAIGONTOURIST_ROOT);
    out["Social Video"] = (out["Social Video"] || []).concat(sgtr);
  } catch (e) {
    console.error("[scan] Saigontourist: " + e.message);
  }
  const data = {};
  for (const [cat, items] of Object.entries(out)) {
    data[cat] = items.map(i => ({ id: i.id, title: cleanName(i.name), thumb: i.thumb }));
  }
  return data;
}

module.exports = { scanAll, cleanName };
