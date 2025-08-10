const path = require("path");

function createCurrentMiddleware() {
  return async function currentMiddleware(name, params) {
    if (!this.stack || !this.stack.length) return;
    
    const filename = this.stack[0].filename;
    let value;
    
    switch (name) {
      case "__filename":
        value = filename;
        break;
      case "__dirname":
        value = path.dirname(filename);
        break;
      case "__basename":
        value = path.basename(filename);
        break;
      case "__name":
        value = path.parse(filename).name;
        break;
      case "__ext":
        value = path.parse(filename).ext;
        break;
      default:
        return undefined;
    }
    
    return value ? {
      type: "text",
      read: async () => value
    } : undefined;
  };
}

module.exports = createCurrentMiddleware;