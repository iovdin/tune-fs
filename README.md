# Tune FS

filesystem middlewares for [Tune](https://github.com/iovdin/tune) - access files and load tools/models from filesystem.

This middleware collection allows you to interact with your filesystem, load tools/models/processors from filesystem, and access files from within your Tune chat sessions.

## Available Middlewares

- `tunefs`: Combined filesystem access (tools + files + .env files)
- `tools`: load tools/models/processors from filesystem using  `.tool.js`, `.llm.js`, `.proc.js`, `.ctx.js` file formats
- `files`: read text files, images, and directories
- `writer`: write files to the filesystem

## Usage Examples

```chat
system: 
@gpt-5-mini.llm.js
@readfile.tool.js

user:
can you read README.md?

tool_call: readfile {"filename": "README.md"}
tool_result:
@README.md

```

## Setup for Text Editor

Install in your `~/.tune` folder:

```bash
cd ~/.tune
npm install tune-fs
```

Add to `~/.tune/default.ctx.js`:

```javascript
const path = require('path')
const tunefs = require('tune-fs')
const { writer } = tunefs

module.exports = [
    ...
    tunefs({
        paths: process.env.TUNE_PATH.split(path.delimiter),
        makeSchema: true
    })
    ...
    writer()
]
```

## Setup for JavaScript Project

```bash
npm install tune-fs tune-sdk
```

```javascript
const tune = require('tune-sdk')
const { tools, files, writer } = require('tune-fs')

const ctx = tune.makeContext(
    tools({ path: './tools' }), // load global tools
    files({ path: `./${userId}`}), // read user files
    writer({ path: `./${userId}`}), // allow user's chat to write to directory
)
const result = await ctx.text2run(`
 system: @readfile @gpt-5-mini 
 user: show me package.json
`)
```

## Configuration Options

### Main Filesystem Middleware
```javascript
tunefs({
  // Filesystem paths to search (array or string)
  paths: ['./tools', './docs'], // or single string: './workspace'
  
  // Mount point prefix
  mount: 'fs',  // Access as @fs/filename
  
  // Schema generation for tools
  makeSchema: true,  // Auto-generate schemas for .tool.js files
  
  // Whitelist specific files
  expose: ['myTool.tool.js', 'config.json', 'helper.py']
})
```

### Individual Middlewares
```javascript
// Tools only - executable files
tools({
  path: './tools',
  mount: 'tools',
  makeSchema: true,
  expose: ['readfile.tool.js', 'gpt-5-mini.llm.js']
})

// Files only - text files and images  
files({
  path: './docs',
  mount: 'files',
  expose: ['readme.md', 'config.json']
})

// File writer
writer() // For writing files
```

## File Types Supported

### Tools
`.tool.js/.tool.mjs/.tool.py/.tool.php/.tool.chat` - Tools with JSON schema.
Works with `tools` middleware.

Example tool file (`readfile.tool.js`):
```javascript
module.exports = function({ filename }, ctx) {
  return `@${filename}`;
}
```

Example schema file (`readfile.schema.json`):
```json
{
  "description": "Read the contents of a specified file",
  "parameters": {
    "type": "object",
    "properties": {
      "filename": {
        "type": "string",
        "description": "The name of the file to read"
      }
    },
    "required": ["filename"]
  }
}
```

### Models
`.llm.js/.llm.mjs/.llm.py/.llm.php` - LLM models.
Works with `tools` middleware.

Example llm file (`gpt-5-mini.llm.js`):
```javascript
module.exports = async function(payload, ctx) {
  const key = await ctx.read('OPENAI_KEY');
  const result =  ({
    url: "https://api.openai.com/v1/chat/completions",
    method: "POST",
    headers: { 
      "content-type": "application/json",
      authorization: `Bearer ${key}` 
    },
    body: JSON.stringify({
      ...payload,
      model: "gpt-5-mini",
      reasoning_effort: "low",
      messages: payload.messages.filter(msg => msg.role !== 'comment'),
    })
  })
  return result
}
```

### Processors
- `.proc.js/.proc.mjs/.proc.py/.proc.php` - processors (used with | syntax).
Works with `tools` middleware.

```chat
system: @{ gpt-5-mini | json_format }
You always respond with JSON:
{
   "message": "Your message"
}
user: 
Hi
assistant:
{
    "message": "Hello how can I help you?"
}
```

Example processor file (`json_format.proc.mjs`):
```
export default async function json_format(node, args, ctx) {
  if (!node) {
    return 
  }
  const response_format = { "type": "json_object" }
  return {
    ...node,
    exec: async (payload, ctx) => node.exec({ ...payload, response_format }, ctx)
  }
}
```

### Context 
- `.ctx.js/.ctx.mjs/.ctx.py/.ctx.php` - Context modifiers.
Works with `tools` middleware.

Example ctx file (`web.ctx.js`):
```
module.exports = async function web(url, args) {
    // not an url, skip to next middleware
    if (url.indexOf("https://") == -1) {
        return 
    }

    return {
        type: "text",
        url,
        read: async () => {
            const res = await fetch(url.trim());
            return res.text()
        }
    }
}
```

Usage example
```chat
system: @web

...

use this words for inspiration/randomness
@https://random-word-api.herokuapp.com/word?number=3

```

### Files 
Works with `files` middleware
- Text files (`.md`, `.txt`, `.json`, `.js`, etc.)
- Images (`.jpg`, `.png`, `.webp`)
- Directories (returns file listing)

```chat
user:
what is on the image @image

user:
are there any excel documents in 
@my/directory

user:
summarize 
@README.md

```

### Environment Variables
- `.env` files are automatically loaded from each search path
- Access variables as `@VARIABLE_NAME`, They can also be read from within tool code (e.g., ctx.read('VAR_NAME')).

## Tool Schema Generation

When `makeSchema: true`, the middleware will:
1. Look for existing `.schema.json` files next to tools
2. Save generated schemas for future use


## Advanced Usage

```javascript
const tunefs = require('tune-fs')
const { tools, files, writer } = tunefs

// Multiple specific middlewares
const ctx = tune.makeContext(
  tools({ path: './tools', makeSchema: true }),
  files({ path: './docs' }),
  files({ path: './assets', mount: 'assets' }),
  writer()
)
```

## File Access Patterns

```chat
 user: @filename.txt              # Exact match
 user: @filename                  # This also works
 user: @tools/converter.tool.js   # Mounted path
 user: @tools/converter           # without extension
 user: @CONFIG_VAR                # Environment variable
```
