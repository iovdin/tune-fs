const path = require("path");
const fs = require("fs");
const { env2vars } = require('./utils');
const createToolsMiddleware = require('./tools');
const createFilesMiddleware = require('./files');

function createFilesystemMiddleware(opts = {}, fsModule) {
  const fsImpl = fsModule || fs;
  let { paths } = opts;
  
  if (!paths) throw Error("paths is not set");
  if (!Array.isArray(paths)) paths = [paths];
  
  const envCache = {};
  
  return async function filesystemMiddleware(name, args) {
    // Get paths from current stack context + configured paths
    const contextPaths = this.stack
      ?.filter(item => !!item.dirname)
      ?.map(item => item.dirname)
      ?.reverse() || [];
    
    const allPaths = contextPaths.concat(paths);
    const handles = [];
    let result = (args.output === "all") ? [] : undefined;
    
    // Check environment variables first
    for (const p of allPaths) {
      const envFile = path.resolve(p, ".env");
      if (!envCache[envFile]) {
        envCache[envFile] = (!envFile || !fsImpl.existsSync(envFile)) 
          ? {} 
          : env2vars(fsImpl.readFileSync(envFile, "utf8"));
      }
      
      if (envCache[envFile][name]) {
        return {
          type: "text",
          read: async () => envCache[envFile][name]
        };
      }
      
      // Create middleware handles for each path
      const pathOpts = Object.assign({}, opts, { path: p });
      handles.push(createToolsMiddleware(pathOpts, fsImpl));
      handles.push(createFilesMiddleware(pathOpts, fsImpl));
    }
    
    // Try each handle until we find a match
    while (handles.length) {
      const handle = handles.shift();
      const res = await handle.call(this, name, args);
      
      if (!res) continue;
      
      if (args.output === "all") {
        Array.isArray(res) ? result = result.concat(res) : result.push(res);
      } else {
        result = res;
        break;
      }
    }
    
    return result;
  };
}

module.exports = createFilesystemMiddleware;
