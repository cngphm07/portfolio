const folders = {
  "Animation Film": "1yEraPbAtP8aQaekiq6cF6Fjxq7log1Sd",
  "Showreel": "1aj1_5jY__3qcJCN-x-95K-hWJ5kZbJy_",
  "Architecture Video": "1E89Ifl6K3kjlqhK2t_E7cQwHShOJ6XKW",
  "Architecture Videography": "1b4Nyhcg_UVP6jDQsXLASxWJoGzo51d7P",
  "Corporate Film": "1WU45wvJYdSNDIepJq-7hWXY6hLC-Zj1F",
  "Documentary Film": "1nLKpfJwpNn7niHKqJpdw1pYr9MxBuNvm",
  "Event": "1G_2ufnr2DcDTnLLtA82dP0q9eTt4qdTK",
  "Music Video": "1dpelQyaBYSDo_5BzHi8r2VNkFv6zUnlE",
  "Photos": "1wJDBRinoQr9xEzBBch_fOmBMFqzIr_by",
  "Podcast": "1X2hUjJycCPYwKpRG3A9gcdFUgdNCVxi9",
  "TVC Screenshots": "15SK7Xrjv2tcWDvD4tKjV4IMbxGwqzJwv",
  "Short Film": "1NxUUIlGlgM8f4Y16GM-F008Ilbimgwli",
  "Social Video": "1iSHrAiAfRTnZFbr7FDGxfZ_Bp4aERkZB",
  "Spa": "1jkjkn-6IXsVX2vALd5X1NVLOMXkRmiIV",
  "TVC": "1sB1XiPgNPd09J1sotBL2tfpGoQ2r46Ht",
  "Wedding": "1uQvNFH_gpHdGH6aPCDX_ggB2zyatBNnY",
};

(async () => {
  const out = {};
  for (const [name, id] of Object.entries(folders)) {
    try {
      const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${id}#grid`);
      const html = await res.text();
      const blocks = html.split('<div class="flip-entry"').slice(1);
      const items = blocks.map(b => {
        const id = (b.match(/id="entry-([A-Za-z0-9_-]{15,})"/) || [])[1] || "";
        const name = ((b.match(/flip-entry-title">([^<]+)</) || [])[1] || "").trim();
        const thumb = (b.match(/<img src="(https:\/\/lh3[^"]+)" alt="Video"/) || [])[1] || "";
        const isFolder = /class="flip-entry-list-icon"/.test(b) && !/alt="Video"/.test(b);
        return { id, name, thumb, isFolder };
      }).filter(i => i.id);
      out[name] = items;
      console.log(`=== ${name} (${items.length}) ===`);
      items.forEach(i => console.log(`  ${i.name}`));
    } catch (e) {
      console.log(`=== ${name} ERROR: ${e.message}`);
      out[name] = [];
    }
  }

  // merge "TIKTOK SAIGONTRAVEL" (a shortcut) -> EXPORT-SAIGONTOURIST folder tree into Social Video
  try {
    async function scanFolder(fid) {
      const res = await fetch("https://drive.google.com/embeddedfolderview?id=" + fid);
      const html = await res.text();
      const blocks = html.split('<div class="flip-entry"').slice(1);
      let vids = [];
      for (const b of blocks) {
        const id = (b.match(/id="entry-([A-Za-z0-9_-]{15,})"/) || [])[1];
        const name = ((b.match(/flip-entry-title">([^<]+)</) || [])[1] || "").trim();
        const thumb = (b.match(/<img src="(https:\/\/lh3[^"]+)" alt="Video"/) || [])[1] || "";
        const isFolder = /folders\//.test(b);
        if (!id) continue;
        if (isFolder) vids = vids.concat(await scanFolder(id));
        else if (/\.(mp4|mov|webm|mkv)$/i.test(name)) vids.push({ id, name, thumb, isFolder: false });
      }
      return vids;
    }
    const items = await scanFolder("1SyHI868_X9sloaWt1uO8peNQINB1RCam");
    out["Social Video"] = (out["Social Video"] || []).filter(i => !i.isFolder).concat(items);
    console.log(`=== Social Video + EXPORT-SAIGONTOURIST (${out["Social Video"].length}) ===`);
    items.forEach(i => console.log(`  ${i.name}`));
  } catch (e) {
    console.log("subfolder ERROR:", e.message);
  }
  require("fs").writeFileSync("drive-data.json", JSON.stringify(out, null, 2));
})();
