const path = require("path");

function extend() {
  var objects = Array.prototype.slice.call(arguments);
  return (function(result) {
    for (let i = 0; i < objects.length; i++) {
      const object = objects[i];
      for (const key in object) {
        const value = object[key];
        if (typeof value !== 'undefined') {
          result[key] = JSON.parse(JSON.stringify(value));
        }
      }
    }
    return result;
  })({});
}

function env2vars(text) {
  // Remove full-line comments that start with '#'
  const filtered = text
    .split(/\r?\n/)
    .filter(line => !/^\s*#/.test(line))
    .join("\n");

  return filtered
    .split(/^(\w+\s*=)/gm)
    .reduce((memo, item, index, arr) => {
      const match = item.match(/^(\w+)\s*=/);
      if (match) {
        memo.push({
          name: match[1],
          content: arr[index + 1].replace(/\n$/, "")
        });
      }
      return memo;
    }, [])
    .reduce((memo, item) => {
      let value = item.content;
      // Remove quotes if present
      value = value.replace(/^\s*'(.*)'\s*$/, "$1");
      value = value.replace(/^\s*"(.*)"\s*$/, "$1");
      // Trim whitespace from unquoted values
      value = value.trim();
      memo[item.name] = value;
      return memo;
    }, {});
}

function pparse(filename) {
  const parsed = path.parse(filename);
  const parsed1 = path.parse(parsed.name);
  if (parsed1.ext) {
    parsed.ext2 = parsed1.ext;
    parsed.name = parsed1.name;
  }
  return parsed;
}

function tpl(str, ...params) {
  return (function(paramIndex, params) {
    try {
      return str.replace(/{(\W*)(\w*)(\W*)}/gm, (_, pre, name, post) => {
        const res = params[name || paramIndex];
        paramIndex += 1;
        return (typeof res !== 'undefined') ? ((pre || "") + res + (post || "")) : "";
      });
    } catch (e) {
      console.log(e, str, ...params);
      return str;
    }
  })(0, ((typeof params[0] === "object") && (params.length === 1)) ? params[0] : params);
}

module.exports = {
  extend,
  env2vars,
  pparse,
  tpl
};