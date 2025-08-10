const assert = require('assert');

const fs = require('fs');
const path = require('path');
const memfs = require('memfs')
const tune = require('tune-sdk');
const tunefs = require('../src/index');
const { tools, files, current, writer } = require('../src/index');

require('dotenv').config()

const env = { 
  OPENAI_KEY: process.env.OPENAI_KEY
}

const tests = {};


function mkvol(files) {
  const vol = new memfs.Volume();
  const fs = memfs.createFsFromVolume(vol)
  let filename = null
  vol.fromJSON({})

  Object.keys(files).forEach(name => {
    const value = files[name]
    const filename = path.resolve("/", name) 
    fs.mkdirSync(path.dirname(filename), { recursive: true })
    fs.writeFileSync(filename, value)
  })
  return fs
}

tests.api_keys = async function(){
   assert.ok(process.env.OPENAI_KEY, "OPENAI_KEY has to be set for testing") 
 }


tests.makeContext1 = async function() {
  console.log("makeContext1 - dir stack")
  let ctx = tune.makeContext( 
    tunefs(
      { paths: "/"},  
      mkvol({ 
        "file.txt": "@@dir1/file",
        "dir1/file.txt": "@file1",
        "dir1/file1.txt": "value"
      }))
  )


  let payload = await tune.text2payload("u: @@file", ctx)
  assert.equal(payload.messages[0].content, "value")
  

  ctx = tune.makeContext(
    { key: "value", key1: "" },
    files(
      { path: "/" },
      mkvol({
        "key": "value1",
        "/dir1/file1": "file1",
        "/dir1/key": "key1",
        "/dir1/file2": "file2",
        "/dir2/file3": "file3",
        "/dir2/file4": "file4",
        "/dir3/file5.txt": "txt",
        "/dir3/file6.csv": "csv"
      })))

  console.log("makeContext1 - env chain")
  assert.ok(!(await ctx.resolve("name")), "name not found")
  let var1 = await ctx.resolve("key")
  assert.ok(var1, "key found")
  assert.equal(await var1.read(), "value")
  assert.ok(await ctx.resolve("key1"), "key1 found")

  // with extension
  console.log("makeContext1 - extension")
  let ctx1 = tune.makeContext(files({ path: "/"}, mkvol({ "file": "0" }) ))
  assert.ok(!(await ctx1.resolve("file.txt")), "resolves to empty")
  ctx1 = tune.makeContext(files({ path: "/" },  mkvol({ "file.txt": "0" })))
  var1 = await ctx1.resolve("file")
  assert.equal(var1.fullname, "/file.txt")
  ctx1 = tune.makeContext(
    files({ path: "/dir1" }, 
       mkvol({
        "/dir1/file1.txt": "1",
        "/dir1/file": "0"
      })))
  var1 = await ctx1.resolve("file1")
  assert.equal(var1.fullname, "/dir1/file1.txt")

  // test "tools/js" like paths
  console.log("makeContext1 - path/file")
  ctx1 = tune.makeContext(
    files(
      { path: "/user" }, 
      mkvol({
        "/user/tools/file": "0",
        "/user/file": "1"
      })))
  var1 = await ctx1.read("tools/file")
  assert.equal(var1.toString("utf8"), "0")

  // resolution order env cwd TUNE_PATHS
  console.log("makeContext1 - resolve order")
  ctx1 = tune.makeContext(
    { file: "0" },
    tunefs(
      { paths: ["/dir1", "/dir2"] }, 
      mkvol({
        "/dir1/file.txt": "1",
        "/dir2/file.txt": "2",
        "/dir3/file.txt": "3" })))

  assert.equal(await ctx1.read("file"), "0")

  ctx1 = tune.makeContext(
    tunefs(
      { paths: ["/dir1", "/dir2", "/dir3"] }, 
      mkvol({
        "/dir1/file.txt": "1",
        "/dir2/file.txt": "2",
        "/dir3/file.txt": "3"
      })))

  assert.equal(await ctx1.read("file"), "1")

  ctx1 = tune.makeContext(
    {},
    tunefs(
      { paths: ["/dir2", "/dir3"] }, 
      mkvol({
        "/dir1/file.txt": "1",
        "/dir2/file.txt": "2",
        "/dir3/file.txt": "3",
        "/dir3/file1.txt": "4"
      })))

  assert.equal(await ctx1.read("file"), "2")
  assert.equal(await ctx1.read("file1"), "4")

  console.log("makeContext1 - .env files")
  ctx1 = tune.makeContext(
    tunefs({ paths: ["/dir1", "/dir2", "/dir3"] }, 
      mkvol({
        "/dir1/.env": "a=1",
        "/dir2/.env": "a=2",
        "/dir3/.env": "a=3"
      })
    )
  )
  assert.equal(await ctx1.read("a"), "1")

  ctx1 = tune.makeContext(
    tunefs({ 
      paths: ["/dir2", "/dir2"] }, 
      mkvol({
        "/dir2/.env": "a=2",
        "/dir3/.env": "a=3"
      })
    )
  )
  assert.equal(await ctx1.read("a"), "2")

  console.log("makeContext1 - default.llm.js")
  ctx1 = tune.makeContext(
    files({ path: "/" }, 
      mkvol({
        "default.llm.js": "llm",
        "default.tool.js": "tool"
      })
    )
  )
  var1 = await ctx1.resolve("default.llm")
  assert.equal(var1.fullname, "/default.llm.js")
  var1 = await ctx1.resolve("default")
  assert.equal(var1.fullname, "/default.llm.js")

  // TODO create directory?
  // TODO read directory as list?
}

tests.contextFilesystem = async function() {
  const ctx = tune.makeContext(
    tunefs({ 
      paths: ["/", "/folder"] }, 
      mkvol({
        "name.txt": "1",
        "image.jpg": "2",
        "binfile": Buffer.from([1]),
        "web.schema.json": JSON.stringify("schema"),
        "web.tool.js": "4",
        "4o.llm.js": "5",
        "ft.proc.js": "6",
        "/folder/name1.txt": "7",
        "name1.txt": "8",
        "4o.txt": "9",
        "/folder/name2.txt": "10"
      })
    )
  )
  
  let var1 = await ctx.resolve("name")
  assert.deepEqual(var1.type, "text")
  assert.equal(await var1.read(), "1")

  var1 = await ctx.resolve("image")
  assert.deepEqual(var1.type, "image")
  assert.deepEqual(await var1.read(), Buffer.from("2"))

  var1 = await ctx.resolve("binfile")
  assert.deepEqual(var1.type, "text")
  await assert.rejects(
    async () => await var1.read(),
    /binary file/
  )

  assert.deepEqual(await var1.read(true), Buffer.from([1]))

  var1 = await ctx.resolve("web")
  assert.deepEqual(var1.type, "tool")
  // assert.deepEqual(await var1.exec(), "TODO")

  var1 = await ctx.resolve("web.tool")
  assert.deepEqual(var1.type, "tool")

  var1 = await ctx.resolve("web.tool.js")
  assert.deepEqual(var1.type, "tool")

  var1 = await ctx.resolve("web", { type: "text" })
  assert.deepEqual(var1.type, "text")

  var1 = await ctx.resolve("web.schema")
  assert.deepEqual(var1.type, "text")

  var1 = await ctx.resolve("web.schema.json")
  assert.deepEqual(var1.type, "text")

  var1 = await ctx.resolve("4o")
  assert.deepEqual(var1.type, "llm")
  // assert.deepEqual(await var1.exec(), "TODO")

  var1 = await ctx.resolve("ft")
  assert.deepEqual(var1.type, "processor")
  // assert.deepEqual(await var1.exec(), "TODO")

  var1 = await ctx.resolve("name2")
  assert.equal(await var1.read(), "10")

  console.log("contextFilesystem options")
  var1 = await ctx.resolve("name\\d", { match: "regex" })
  assert.equal(var1.fullname, "/name1.txt")

  var1 = await ctx.resolve("name1", { output: "all" })
  assert.equal(var1.length, 2)

  var1 = await ctx.resolve("4o", { output: "all" })
  assert.equal(var1.length, 3)
  var1 = await ctx.resolve("4o", { type: "text" })
  assert.equal(var1.type, "text")
}

tests.contextEval = async function() {
  const ctx = tune.makeContext(tools({ path: __dirname }))

  const var1 = await ctx.resolve("plus")
  assert.equal(var1.type, "tool")
  assert.ok(var1.schema)
  assert.equal(await var1.exec({ a: 1, b: 2 }), 3)
}

tests.contextFile = async function() {
  console.log("contextFile - simple resolve/read")
  let ctx = tune.makeContext(files({ path: __dirname }))
  let var1 = await ctx.resolve("test")
  var1 = await ctx.read("test")
  assert.equal(var1.trim(), "TEST")

  console.log("contextFile - files, resolve as text")
  ctx = tune.makeContext(files({ path: __dirname }))
  var1 = await ctx.resolve("plus.tool.js")
  assert.equal(var1.type, "text")

  console.log("contextFile - files, mount")
  ctx = tune.makeContext(files({ path: __dirname, mount: "dir" }))
  var1 = await ctx.resolve("dir/plus.tool.js")
  assert.equal(var1.type, "text")

  var1 = await ctx.resolve("plus.tool.js")
  assert.ok(!var1, "plus.tool.js found, it should not")

  console.log("contextFile - files, expose")
  ctx = tune.makeContext(files({ path: __dirname, expose: ["plus.tool.js"] }))
  var1 = await ctx.resolve("plus.tool.js")
  assert.ok(var1, "expose plus.tool.js not found")
  var1 = await ctx.resolve("test")
  assert.ok(!var1, "expose test file found")

  console.log("contextFile - tools, simple tool found")
  ctx = tune.makeContext(tools({ path: __dirname }))
  var1 = await ctx.resolve("plus")
  assert.equal(var1.type, "tool")
  // TODO: mount, expose for toosl and fs

  console.log("contextFile - mix, simple tool found")
  ctx = tune.makeContext(tunefs({ paths: __dirname, expose: ['plus.tool.js'] }))
  var1 = await ctx.resolve("plus")
  assert.equal(var1.type, "tool")
  var1 = await ctx.resolve("bool")
  assert.ok(!var1, "bool is found, when it should not")
}


tests.toolCall2 = async function() {
  const vol = mkvol({
    "template.chat": "s: @system\nu: @text",
    "template2.chat": "u: 1 + 1\na: 2\nu: @text",
    "system.txt": "You are Groot"
  })
  
  const ctx = tune.makeContext(
    process.env,
    tunefs({ paths: "/" }, vol),
    tunefs({ paths: __dirname })
  )

  let tool1 = await ctx.resolve("js")
  assert.equal(await tool1.exec({ text: "console.log(1)" }), "1")

  console.log("toolCall2 py")
  tool1 = await ctx.resolve("py")
  assert.equal(await tool1.exec({ text: "print(1)" }), "1")

  console.log("toolCall2 1")
  let resolved = await ctx.resolve("template")
  let result = await tunefs.runFile(resolved.fullname, ctx, { text: "hi how are you?" })
  assert(result.toLowerCase().includes("i am groot"), "includes i am groot")

  console.log("toolCall2 2")
  resolved = await ctx.resolve("template2")
  result = await tunefs.runFile(resolved.fullname, ctx, { text: "1+2" })
  assert.match(result.trim(), /3/)

  // chat with tool calls
}

tests.toolCall4 = async function() {
  console.log("test tool.py")

  const ctx = tune.makeContext(
    { name: "hello" },
    tunefs({ paths: __dirname })
  )
  
  console.log("test tool.py sum")
  assert.equal(await tunefs.runFile("test/sum.tool.py", ctx, { a: 1, b: 1 }), 2)
  console.log("test tool.py stdout")
  assert.deepEqual(await tunefs.runFile("test/stdout.tool.py", ctx), ["error\n", 1])

  console.log("test tool.py struct")
  assert.deepEqual(await tunefs.runFile("test/struct.tool.py", ctx), { a: 1, b: true, c: [1, 2, 3] })

  console.log("test tool.py error")
  await assert.match(await tunefs.runFile("test/error.tool.py", ctx), /error/)
  console.log("test tool.py bytes")
  const res = await tunefs.runFile("test/bytes.tool.py", ctx)
  assert.equal(res.toString("utf8"), "12345")

  // TODO py tools can read from another process context
  // const tool = await makeTool("test/env.tool.py", ctx)
  // assert.equal(await tool({ name: "variable" }), "hello")
}

tests.toolCall5 = async function() {
  console.log("test tool.php")

  const ctx = tune.makeContext(process.env)

  assert.equal(await tunefs.runFile("test/sum.tool.php", ctx, { a: 1, b: 1 }), 2)

  assert.deepEqual(await tunefs.runFile("test/stdout.tool.php", ctx), ["error\n", 1])
  assert.deepEqual(await tunefs.runFile("test/struct.tool.php", ctx), { a: 1, b: true, c: [1, 2, 3] })

  // TODO show trace and line in the file
  assert.match( await tunefs.runFile("test/error.tool.php", ctx), /error.tool.php/)
  
  const res = await tunefs.runFile("test/bytes.tool.php", ctx)
  assert.equal(res.toString("utf8"), "12345")
}

tests.toolCall6 = async function() {
  console.log("toolCall6 - schema missing error")
  const conf = {
    type: "llm",
    exec: async (args, ctx) => {
      const key = await ctx.read("OPENAI_KEY")
      if (!key) {
        throw new Error("OPENAI_KEY not found")
      }
      return {
        url: "https://api.openai.com/v1/chat/completions",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "authorization": "Bearer " + key
        },
        body: JSON.stringify({
          messages: args.messages,
          tools: args.tools,
          model: "gpt-4.1-mini"
        })
      }
    }
  }

  const assertErr = async (message, tool) => {
    await assert.rejects(
      async () => {
        const ctx = tune.makeContext({
          tool: tool,
          "default": conf
        })
        const payload = await tune.text2payload("u: @tool\ntc: tool", ctx)
        await tune.payload2http(payload, ctx)
      },
      {
        name: "TuneError",
        message: message
      }
    )
  }

  await assertErr(
    "schema has to be set for 'tool'",
    {
      type: "tool",
      exec: () => 1
    }
  )

  await assertErr(
    "no description set for 'tool'",
    {
      type: "tool",
      schema: {},
      exec: () => 1
    }
  )

  await assertErr(
    "no parameters set for 'tool'",
    {
      type: "tool",
      schema: { description: "hello world" },
      exec: () => 1
    }
  )

  await assertErr(
    "no parameters.type set for 'tool'",
    {
      type: "tool",
      schema: {
        description: "hello world",
        parameters: {}
      },
      exec: () => 1
    }
  )

  await assertErr(
    "no parameters.properties set for 'tool'",
    {
      type: "tool",
      schema: {
        description: "hello world",
        parameters: { type: "type" }
      },
      exec: () => 1
    }
  )

  console.log("toolCall6 - throw error from tool")
  const ctx = tune.makeContext(tunefs({ paths: __dirname }))
  const tc = async (text) => {
    const payload = await tune.text2payload(text, ctx)
    const res = await tune.toolCall(payload, ctx)
    return tune.msg2text(res)
  }

  await assert.rejects(
    async () => await tc("u: @err\ntc: err"),
    {
      name: "TuneError",
      message: "message"
    }
  )

  await assert.rejects(
    async () => await tc("u: hello \ntc: err"),
    {
      name: "TuneError",
      message: "tool 'err' not defined"
    }
  )

  console.log("toolCall6 - schema generation")

  const schemaFile = path.resolve(__dirname, "bool.schema.json")
  if (fs.existsSync(schemaFile)) {
    fs.unlinkSync(schemaFile)
  }

  let ctx2 = tune.makeContext(env, tools({ path: __dirname, makeSchema: false }))
  
  await assert.rejects(
    async () => ctx2.resolve("bool"),
    { message: /schema file not found/ }
  )



  ctx2 = tune.makeContext(env, tools({ path: __dirname, makeSchema: true }))

  const payload = await tune.text2payload("u: @bool hi, how are you?", ctx2)
  assert.ok(fs.existsSync(schemaFile), "schema has not been generated")
  assert.doesNotThrow(() => JSON.parse(fs.readFileSync(schemaFile, "utf8")), "can not parse schema file")
}

tests.toolCall7 = async function() {
  console.log("check return types")

  const ctx = tune.makeContext(
    tunefs({ paths: __dirname }),

    async function write (name, args, ctx)  {
      fs.writeFileSync(path.resolve(__dirname, name), args)
    }
  )

  const tc = async (text) => {
    const payload = await tune.text2payload(text, ctx)
    const res = await tune.toolCall(payload, ctx)
    return tune.msg2text(res)
  }

  assert.equal(
    await tc("u: @num do random thing\ntc: num"),
    "tr: 2"
  )
  assert.equal(
    await tc("u: @str do random thing\ntc: str"),
    "tr: str"
  )
  assert.equal(
    await tc("u: @bool do random thing\ntc: bool"),
    "tr: true"
  )
  assert.equal(
    await tc("u: @null do random thing\ntc: null"),
    "tr: null"
  )
  assert.equal(
    await tc("u: @undefined do random thing\ntc: undefined"),
    "tr: undefined"
  )
  assert.equal(
    await tc("u: @obj do random thing\ntc: obj"),
    "tr: { a: 1 }"
  )

  await assert.rejects(
    async () => await tc("u: @err do random thing\ntc: err"),
    {
      name: "TuneError",
      message: /message/
    }
  )

  // const res = await tc("u: @buf do random thing\ntc: buf")
  // assert.match(res, /tr: @content.*/)
}

tests.toolCall8 = async function() {
  console.log("check export functions")
  const ctx = tune.makeContext(process.env, tunefs({ paths: __dirname }))
  
  await assert.rejects(
    async () => await tune.text2run("u: @noexport\n 23 * 32?", ctx, { stop: "assistant" }),
    { message: /JS file does not export default function/ }
  )
  
  await assert.rejects(
    async () => await tune.text2run("u: @noexport2\n 23 * 32?", ctx, { stop: "assistant" }),
    { message: /JS file does not export default function/ }
  )
}

tests.pparse1 = async function() {
  assert.deepEqual(tunefs.pparse("/home/dir/file.js"), {
    root: "/",
    dir: "/home/dir",
    base: "file.js",
    ext: ".js",
    name: "file"
  })

  assert.deepEqual(tunefs.pparse("/home/dir/file.llm.js"), {
    root: "/",
    dir: "/home/dir",
    base: "file.llm.js",
    ext: ".js",
    ext2: ".llm",
    name: "file"
  })
}

// test.writer = async () => {
//
// }

async function run(testList=[]){
  testList = testList.length ? testList : Object.keys(tests)
  let curTest
  while(curTest = testList.shift()) {
    try {
      await tests[curTest]()
      console.log(`pass: ${curTest}`)
    } catch (e) {
      console.log(`fail: ${curTest}`)
      console.error(e)
    }
  }
  

}
run(process.argv.slice(2));
