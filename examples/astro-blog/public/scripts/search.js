// Pagefind is generated after Astro builds; keep its runtime import outside the bundler.

const form = document.querySelector('#article-search')
const input = document.querySelector('#search-query')
const results = document.querySelector('#search-results')
const status = document.querySelector('#search-status')
let request = 0
form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const current = ++request
  status.textContent = 'Searching…'
  results.replaceChildren()
  try {
    const modulePath = `${form.dataset.base}/pagefind/pagefind.js`
    const pagefind = await import(modulePath)
    const found = await pagefind.search(input.value)
    const pages = await Promise.all(found.results.slice(0, 20).map((result) => result.data()))
    if (request !== current) return
    for (const page of pages) {
      const item = document.createElement('li')
      const link = document.createElement('a')
      link.href = page.url
      link.textContent = page.meta.title ?? page.url
      item.append(link)
      results.append(item)
    }
    status.textContent = `${found.results.length} result(s)`
  } catch {
    if (request === current)
      status.textContent = 'Search index unavailable. Build the site and run Pagefind first.'
  }
})
