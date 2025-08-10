module.exports = async function(payload, ctx) {
  const key = await ctx.read('OPENAI_KEY');
  const result =  ({
    url: url || "https://api.openai.com/v1/chat/completions",
    method: "POST",
    headers: { 
      "content-type": "application/json",
      authorization: `Bearer ${key}` 
    },
    console.log("payload", payload)
    body: JSON.stringify({
      ...payload,
      model: "gpt-5-mini",
      reasoning_effort: "low",
      messages: payload.messages.filter(msg => msg.role !== 'comment'),
    })
  })
  // console.log(result)
  return result
}
