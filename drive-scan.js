// Shared Drive scanning logic used by both build-data.js and server.js
const FOLDERS = {
  "Animation Film": "1yEraPbAtP8aQaekiq6cF6Fjxq7log1Sd",
  "Architecture Film": "1E89Ifl6K3kjlqhK2t_E7cQwHShOJ6XKW",
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
const ARCH_VIDEOGRAPHY_ROOT = "1b4Nyhcg_UVP6jDQsXLASxWJoGzo51d7P";
// subfolder that duplicates the standalone "Architecture Video" category
const ARCH_VIDEOGRAPHY_SKIP = ["Architecture Video"];

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

  // Architecture Videography: nested category — one entry per subfolder
  try {
    const subs = {};
    for (const e of await fetchEntries(ARCH_VIDEOGRAPHY_ROOT)) {
      if (!e.isFolder || ARCH_VIDEOGRAPHY_SKIP.includes(e.name)) continue;
      const vids = await scanFolderRecursive(e.id);
      if (vids.length) subs[e.name] = vids;
      console.log(`[scan] Arch Videography / ${e.name}: ${vids.length}`);
    }
    out["Architecture"] = subs;
  } catch (e) {
    console.error("[scan] Arch Videography: " + e.message);
  }

  const data = {};
  for (const [cat, items] of Object.entries(out)) {
    if (Array.isArray(items)) {
      data[cat] = items.map(toVideo);
    } else {
      // nested category: { subName: [entries] }
      data[cat] = {};
      for (const [sub, vids] of Object.entries(items)) {
        data[cat][sub] = vids.map(toVideo);
      }
    }
  }
  await markDarkThumbs(data);
  return data;
}

function toVideo(i) {
  return {
    id: i.id,
    title: cleanName(i.name),
    // stable per-file thumbnail; the lh3 URLs from the folder view expire
    thumb: `https://drive.google.com/thumbnail?id=${i.id}&sz=w400`,
  };
}

// Drive thumbnails are auto-generated from the video's first frame; when that
// frame is flat black the thumb JPEG compresses to ~0.8-1.6KB while real
// content starts around 16KB. Band 2-2.8KB is still near-unreadable dark
// scenes; ~4KB+ keeps readable posters (e.g. logo title cards).
const DARK_THUMB_BYTES = 2800;

async function probeThumbSize(id) {
  // one retry: Drive rate-limits bursts and a 429 must not silently unflag
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`https://drive.google.com/thumbnail?id=${id}&sz=w400`);
      if (!res.ok) { await new Promise(r => setTimeout(r, 400 * (attempt + 1))); continue; }
      const buf = await res.arrayBuffer();
      return buf.byteLength;
    } catch (e) {
      await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  return 0;
}

async function markDarkThumbs(data) {
  const vids = [];
  for (const cat of Object.values(data)) {
    if (Array.isArray(cat)) vids.push(...cat);
    else for (const arr of Object.values(cat)) vids.push(...arr);
  }
  let idx = 0, flagged = 0;
  async function worker() {
    while (idx < vids.length) {
      const v = vids[idx++];
      const size = await probeThumbSize(v.id);
      if (size && size < DARK_THUMB_BYTES) { v.thumbDark = true; flagged++; }
    }
  }
  await Promise.all(Array.from({ length: 12 }, worker));
  console.log(`[scan] ${flagged}/${vids.length} thumbnails flagged dark`);
}

module.exports = { scanAll, cleanName };
