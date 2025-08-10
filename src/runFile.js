const path = require("path");
const { spawnSync } = require("child_process");
const { pparse, tpl, extend } = require('./utils');
const msgpack = require('./msgpack');

async function runFile(filename, ctx, ...args) {
  try {
    const parsed = pparse(filename);
    
    if (parsed.ext === ".chat") {
      const res = await ctx.file2run({
        filename: filename,
        stop: "assistant"
      }, args[0]);
      return res.replace(/@/g, "\\@");
    } 
    else if (parsed.ext === ".mjs") {
      const module = await import(filename + "?t=" + Date.now());
      if (typeof module.default !== "function") {
        throw Error("JS file does not export default function");
      }
      return module.default.call(ctx, ...args, ctx);
    } 
    else if (parsed.ext === ".js" || parsed.ext === ".cjs") {
      // Clear require cache to get fresh module
      delete require.cache[require.resolve(filename)];
      const module = require(filename);
      if (typeof module !== "function") {
        throw Error("JS file does not export default function");
      }
      return module.call(ctx, ...args, ctx);
    } 
    else if (parsed.ext === ".py" || parsed.ext === ".php") {
      const interpreter = parsed.ext === ".py" ? "python" : "php";
      const runScript = parsed.ext === ".py" ? "run.py" : "run.php";
      
      const res = spawnSync(interpreter, [path.resolve(__dirname, runScript)], {
        input: JSON.stringify({
          filename: filename,
          arguments: args[0],
          ctx: ""
        }),
        env: process.env
      });
      
      if (res.error) throw res.error;
      
      let result = [];
      if (res.stderr.length) {
        result.push(res.stderr.toString("utf8"));
      }
      if (res.stdout.length) {
        try {
          const sres = msgpack.deserialize(Buffer.from(res.stdout.toString("utf8"), "hex"));
          Array.isArray(sres) ? result = result.concat(sres) : result.push(sres);
        } catch (e) {
          console.log("cant decode messagepack", e);
          result.push(res.stdout.toString("utf8"));
        }
      }
      
      return result.length === 1 ? result[0] : result;
    } 
    else {
      throw Error(tpl("{ext} extension is not supported, for {filename}", {
        ext: parsed.ext,
        filename: filename
      }));
    }
  } catch (e) {
    throw e;
  }
}

module.exports = runFile;
