addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  return new Response("Hello from Cloudflare Worker!", {
    headers: { "Content-Type": "text/plain" },
    status: 200
  })
}
