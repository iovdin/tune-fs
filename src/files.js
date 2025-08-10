const path = require("path");
const fs = require("fs");
const { pparse, tpl } = require('./utils');

function createFilesMiddleware(opts = {}, fsModule) {
  const fsImpl = fsModule || fs;
  if (!opts.path) throw Error("path is not set");
  
  return async function filesMiddleware(name, args) {
    
    let result = (args.output === "all") ? [] : undefined;
    
    if (!name) return;
    
    name = path.normalize(name);
    
    // Handle mount prefix
    if (opts.mount) {
      const prefix = path.normalize(opts.mount + "/");
      if (name.indexOf(prefix) === 0) {
        name = name.substr(prefix.length);
      } else {
        return;
      }
    }
    
    const parsed = (args.match === "exact") ? pparse(path.resolve(opts.path, name)) : undefined;
    const dir = parsed?.dir || opts.path;
    const re = (args.match === "regex") ? new RegExp(name) : undefined;
    
    if (!fsImpl.existsSync(dir)) return;
    
    const items = fsImpl.readdirSync(dir);
    
    for (const item of items) {
      const parsed1 = pparse(path.join(dir, item));
      
      // Check matching criteria
      if (args.match === "exact" && 
          parsed.base !== item && 
          parsed.base !== (parsed1.name + parsed1.ext2) && 
          parsed.base !== parsed1.name) {
        continue;
      }
      
      if (re && !re.test(item)) continue;
      
      // Check expose whitelist
      if (opts.expose && opts.expose.indexOf(item) === -1) continue;
      
      const fileType = [".jpg", ".jpeg", ".png", ".webp"].includes(parsed1.ext) ? "image" : "text";
      const fullname = path.resolve(dir, item);
      
      if (args.type !== "any" && args.type !== fileType) continue;
      
      let res;
      
      switch (fileType) {
        case "image":
          let mimetype;
          if ([".jpg", ".jpeg"].includes(parsed1.ext)) {
            mimetype = "image/jpeg";
          } else if (parsed1.ext === ".png") {
            mimetype = "image/png";
          } else if (parsed1.ext === ".webp") {
            mimetype = "image/webp";
          }
          
          res = {
            type: "image",
            dirname: parsed1.dir,
            fullname: fullname,
            mimetype: mimetype,
            read: async () => fsImpl.readFileSync(fullname)
          };
          break;
          
        case "text":
          res = {
            type: "text",
            dirname: parsed1.dir,
            fullname: fullname,
            name: parsed1.name,
            read: async (binary) => {
              const stat = fsImpl.lstatSync(fullname);
              if (stat.isDirectory()) {
                return fsImpl.readdirSync(fullname);
              }
              if (binary) {
                return fsImpl.readFileSync(fullname);
              }
              

              const buf = fsImpl.readFileSync(fullname, "utf8");
              
              // Check for binary content
              for (let i = 0; i < Math.min(1024, buf.length); i++) {
                const c = buf.charCodeAt(i);
                if (c === 65533 || c <= 8) {
                  throw Error(tpl("{} is a binary file, can not include it", fullname));
                }
              }
              
              return buf;
            }
          };
          break;
      }
      
      if (args.output === "all") {
        result.push(res);
      } else {
        result = res;
        break;
      }
    }
    
    return result;
  };
}

module.exports = createFilesMiddleware;
