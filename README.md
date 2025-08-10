# Tune FS

Filesystem middlewares for [Tune](https://github.com/iovdin/tune) - access files and executable tools directly in your chat context.

This middleware collection allows you to interact with your filesystem, execute tools, and access files from within your Tune chat sessions.

## Available Middlewares

- **Main (`fs`)**: Combined filesystem access (tools + files + environment variables)
- **Tools**: Execute `.tool.js`, `.llm.js`, `.proc.js`, `.ctx.js` files
- **Files**: Access text files, images, and directories
- **Current**: Access current file context (`__filename`, `__dirname`, etc.)
- **Writer**: Write files to the filesystem

## Usage Examples

```chat
 system: Access your project files and tools

 user: 
Show me @README.md

 assistant:
*reads and displays README.md content*

 user:
Run @converter.tool.js with input "hello world"

 assistant: 
*executes the converter tool and shows results*
```

## Setup for Text Editor

Install in your `~/.tune` folder:

```bash
cd ~/.tune
npm install tune-fs
```

Add to `~/.tune/default.ctx.js`:

```javascript
const fs = require('tune-fs')

module.exports = [
    fs({
        paths: ['./tools', './docs'],
        mount: 'fs',
        makeSchema: true,
        expose: ['converter.tool.js', 'readme.md', 'config.json']
    })
]
```

## Setup for JavaScript Project

```bash
npm install tune-fs tune-sdk
```

```javascript
const tune = require('tune-sdk')
const fs = require('tune-fs')
const { tools, files, current, writer } = require('tune-fs')

const ctx = tune.makeContext(
    {},
    fs({ 
        paths: './workspace',
        makeSchema: true 
    }),
    current(),
    writer()
)

const result = await ctx.text2run(`
 system: You can access files with @filename
 user: show me @package.json
`)
```

## Configuration Options

### Main Filesystem Middleware
```javascript
fs({
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
  expose: ['converter.tool.js', 'processor.proc.js']
})

// Files only - text files and images  
files({
  path: './docs',
  mount: 'files',
  expose: ['readme.md', 'config.json']
})

// Current file context
current() // Provides __filename, __dirname, __basename, __name, __ext

// File writer
writer() // For writing files
```

## File Types Supported

### Executable Tools
- `.tool.js/.tool.mjs/.tool.py/.tool.php/.tool.chat` - Tools with JSON schema
- `.llm.js/.llm.mjs/.llm.py/.llm.php` - LLM processors  
- `.proc.js/.proc.mjs/.proc.py/.proc.php` - General processors
- `.ctx.js/.ctx.mjs/.ctx.py/.ctx.php` - Context modifiers

### Files
- Text files (`.md`, `.txt`, `.json`, `.js`, etc.)
- Images (`.jpg`, `.png`, `.webp`)
- Directories (returns file listing)

### Environment Variables
- `.env` files are automatically loaded from each search path
- Access variables as `@VARIABLE_NAME`

## Tool Schema Generation

When `makeSchema: true`, the middleware will:
1. Look for existing `.schema.json` files next to tools
2. Save generated schemas for future use

Example tool file (`converter.tool.js`):
```javascript
module.exports = function(params, ctx) {
  return `Converted: ${params.input}`;
}
```

Example schema file (`converter.schema.json`):
```json
{
  "type": "function",
  "function": {
    "name": "converter",
    "description": "Convert input text",
    "parameters": {
      "type": "object", 
      "properties": {
        "input": {
          "type": "string",
          "description": "Text to convert"
        }
      },
      "required": ["input"]
    }
  }
}
```

## Advanced Usage

```javascript
const fs = require('tune-fs')
const { tools, files, current, writer } = require('tune-fs')

// Multiple specific middlewares
const ctx = tune.makeContext(
  {},
  tools({ path: './tools', makeSchema: true }),
  files({ path: './docs' }),
  files({ path: './assets', mount: 'assets' }),
  current(),
  writer()
)

// Mixed paths with different configurations
const ctx = tune.makeContext(
  {},
  fs({ 
    paths: ['./tools', './scripts'],
    makeSchema: async (options, ctx) => {
      // Custom schema generator
      return await generateCustomSchema(options.text);
    }
  })
)
```

## File Access Patterns

```chat
 user: @filename.txt              # Exact match
 user: @tools/converter.tool.js   # Mounted path
 user: @__filename               # Current file name
 user: @__dirname               # Current directory
 user: @CONFIG_VAR              # Environment variable
 user: @*.js                    # Regex pattern (if supported)
```
