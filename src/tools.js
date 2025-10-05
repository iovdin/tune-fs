const path = require("path");
const fs = require("fs");
const tune = require("tune-sdk");
const { pparse, tpl } = require('./utils');
const runFile = require('./runFile');

const makeSchema = async function (params, ctx) {
  const filename = path.resolve(__dirname, "make_schema.chat");
  const lctx = ctx.clone()
  lctx.ms.unshift(localToolsMiddleware)
  lctx.ms.unshift(localFilesMiddleware)

  return lctx.file2run({ filename: "make_schema.chat" }, params);
}

function createToolsMiddleware(opts = {}, fsModule) {
  const fsImpl = fsModule || fs;
  if (!opts.path) throw Error("path is not set");
  
  return async function toolsMiddleware(name, args) {
    
    const self = this;
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
      
      // Only process tool files
      if (!([".tool", ".llm", ".proc", ".ctx"].includes(parsed1.ext2)) ||
          !([".js", ".mjs", ".cjs", ".py", ".php", ".chat"].includes(parsed1.ext))) {
        continue;
      }
      
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
      
      const fileType = {
        ".tool": "tool",
        ".llm": "llm", 
        ".proc": "processor",
        ".ctx": "context"
      }[parsed1.ext2];
      
      const fullname = path.resolve(dir, item);
      
      if (args.type !== "any" && args.type !== fileType) continue;
      
      let res;
      
      switch (fileType) {
        case "tool":
          const schemaFile = path.format({
            root: parsed1.root,
            dir: parsed1.dir,
            name: parsed1.name,
            ext: ".schema.json"
          });
          
          let schema;
          if (fsImpl.existsSync(schemaFile)) {
            try {
              schema = JSON.parse(fsImpl.readFileSync(schemaFile, "utf8"));
            } catch (e) {
              throw new Error(tpl("Can not parse schema {schemaFile}\n{message}", {
                schemaFile: schemaFile,
                message: e.message
              }));
            }
          } else if (opts.makeSchema && args.output !== "all") {
            schema = await makeSchema({
              text: fsImpl.readFileSync(fullname, "utf8")
            }, self);
            fsImpl.writeFileSync(schemaFile, schema);
            schema = JSON.parse(schema);
          } 
          /*
          else {
            throw new Error("schema file not found " + schemaFile);
          }
          */
          
          res = {
            type: "tool",
            schema: schema,
            name: parsed1.name,
            exec: async (params, ctx) => runFile(fullname, ctx, params),
            read: async () => fsImpl.readFileSync(fullname, "utf8"),
            dirname: parsed1.dir,
            fullname: fullname
          };
          break;
          
        case "llm":
          res = {
            type: "llm",
            dirname: parsed1.dir,
            fullname: fullname,
            name: parsed1.name,
            exec: async (payload, ctx) => runFile(fullname, ctx, payload),
            read: async () => fsImpl.readFileSync(fullname, "utf8")
          };
          break;
          
        case "context":
          if (args.output !== "all") {
            self.use(async function(name, args) {
              return runFile(fullname, this, name, args);
            });
          }
          res = {
            type: "text",
            fullname: fullname,
            name: parsed1.name,
            dirname: parsed1.dir,
            read: async () => ""
          };
          break;
          
        case "processor":
          res = {
            type: "processor",
            name: parsed1.name,
            exec: (node, args, ctx) => runFile(fullname, ctx, node, args),
            read: async () => fsImpl.readFileSync(fullname, "utf8"),
            dirname: parsed1.dir,
            fullname: fullname
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


const localFilesMiddleware = require('./files')({ path: __dirname })
const localToolsMiddleware = createToolsMiddleware({ path: __dirname })

module.exports = createToolsMiddleware;
