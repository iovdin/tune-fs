const path = require("path");
const fs = require("fs");

function toArray(x) { return Array.isArray(x) ? x : (x ? [x] : []); }
function canon(p) {
  try { return fs.realpathSync.native ? fs.realpathSync.native(p) : fs.realpathSync(p); }
  catch { return path.resolve(p); }
}
function isInside(base, target) {
  base = path.resolve(base);
  target = path.resolve(target);
  if (process.platform === "win32") { base = base.toLowerCase(); target = target.toLowerCase(); }
  const rel = path.relative(base, target);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function createWriterMiddleware(opts = {}) {
  const allowed = toArray(opts.paths).map(canon).filter(Boolean);

  return async function writeFile(filename, data) {
    const abs = path.resolve(filename);

    // Resolve symlinks for existing parts to guard against writes escaping allowed roots
    let dir = path.dirname(abs);
    let probe = dir, prev;
    while (!fs.existsSync(probe)) { prev = probe; probe = path.dirname(probe); if (probe === prev) break; }
    let realBase = probe && fs.existsSync(probe) ? canon(probe) : probe || dir;
    const remainder = path.relative(probe || dir, abs);
    let realTarget = remainder ? path.join(realBase || "", remainder) : (fs.existsSync(abs) ? canon(abs) : abs);

    // If the file itself exists as a symlink, resolve it
    try {
      const st = fs.lstatSync(abs);
      if (st.isSymbolicLink()) realTarget = canon(abs);
    } catch {}

    if (allowed.length) {
      const ok = allowed.some(base => isInside(base, realTarget) || path.resolve(base) === path.resolve(realTarget) || isInside(base, path.dirname(realTarget)));
      if (!ok) throw new Error(`write not allowed: ${filename}`);
    }

    const directory = path.dirname(abs);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(abs, data);
    return true;
  };
}

module.exports = createWriterMiddleware;
// TODO limit paths to where it can write
