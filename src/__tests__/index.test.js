const assert = require('node:assert/strict')
const { test, beforeEach, afterEach, mock } = require('node:test')
const { isDeepStrictEqual } = require('node:util')

function unexpectedFetch () {
  throw new Error('Unexpected fetch: tests must provide an offline response')
}

const nodeFetch = mock.fn(unexpectedFetch)
const fetchPath = require.resolve('node-fetch')
const originalFetchModule = require.cache[fetchPath]
let api

// Capture the offline fetch in the real CommonJS module, then restore the cache.
// The native runner isolates this file in its own process; no module-mock flag
// or runtime-source transformation is needed.
try {
  require.cache[fetchPath] = { id: fetchPath, filename: fetchPath, loaded: true, exports: nodeFetch }
  api = require('../')
} finally {
  if (originalFetchModule) require.cache[fetchPath] = originalFetchModule
  else delete require.cache[fetchPath]
}

const { getProxyList, search, checkIsUp } = api

function assertCalledWith (fn, ...expected) {
  assert.ok(fn.mock.calls.some(call => isDeepStrictEqual(call.arguments, expected)))
}

const html = `
  <table id="searchResult">
    <tr><th>Name</th><th>Description</th><th>Seeds</th><th>Peers</th></tr>
    <tr>
      <td></td>
      <td>
        <a class="detLink" href="/fixture/one">Synthetic &amp; public-domain fixture</a>
        <font class="detDesc">Made-up metadata for a unit test</font>
        <a href="magnet:fixture-one">Synthetic link</a>
      </td>
      <td>12</td><td>3</td>
    </tr>
    <tr>
      <td></td><td><a class="detLink" href="/fixture/two">Second fixture</a></td>
      <td>0</td><td>1</td>
    </tr>
    <tr><td>No named result</td></tr>
  </table>
  <table><tr><td><a class="detLink">Outside the result table</a></td></tr></table>
`

beforeEach(() => {
  nodeFetch.mock.resetCalls()
  nodeFetch.mock.mockImplementation(unexpectedFetch)
  mock.timers.enable({ apis: ['setTimeout'] })
})

afterEach(() => {
  mock.timers.reset()
})

test('exports the supported public functions', () => {
  assert.deepEqual(Object.keys(api).sort(), ['checkIsUp', 'getProxyList', 'search'])
  Object.keys(api).forEach(name => assert.equal(typeof api[name], 'function'))
})

test('parses only named result rows into the public result shape', async () => {
  const text = mock.fn(() => Promise.resolve(html))
  const fetch = mock.fn(() => Promise.resolve({ text }))

  assert.deepEqual(await search('synthetic & example', {
    fetch,
    baseURL: 'https://search.example.invalid',
    page: 2,
    ordering: 'uploaded'
  }), [
    {
      name: 'Synthetic & public-domain fixture',
      link: '/fixture/one',
      seeds: '12',
      peers: '3',
      description: 'Made-up metadata for a unit test',
      file: 'magnet:fixture-one'
    },
    {
      name: 'Second fixture',
      link: '/fixture/two',
      seeds: '0',
      peers: '1',
      description: '',
      file: undefined
    }
  ])
  assert.equal(fetch.mock.callCount(), 1)
  assertCalledWith(fetch, 'https://search.example.invalid/search/synthetic%20%26%20example/2/3/0')
  assert.equal(text.mock.callCount(), 1)
  assert.equal(nodeFetch.mock.callCount(), 0)
})

test('uses the default fetch, page, and ordering with an offline response', async () => {
  nodeFetch.mock.mockImplementation(() => Promise.resolve({ text: () => Promise.resolve('<p>No results</p>') }))
  assert.deepEqual(await search('fixture'), [])
  assert.equal(nodeFetch.mock.callCount(), 1)
  assertCalledWith(nodeFetch, 'https://thepiratebay.org/search/fixture/0/7/0')
})

for (const [ordering, value] of [
  ['default', 99], ['uploaded', 3], ['size', 5],
  ['uploadedBy', 11], ['seeders', 7], ['leechers', 9]
]) {
  test(`encodes a query and maps ${ordering} ordering`, async () => {
    const fetch = mock.fn(() => Promise.resolve({ text: () => Promise.resolve('') }))
    assert.deepEqual(await search('fixture / café?', {
      fetch, baseURL: 'https://search.example.invalid', ordering
    }), [])
    assertCalledWith(fetch, `https://search.example.invalid/search/fixture%20%2F%20caf%C3%A9%3F/0/${value}/0`)
  })
}

for (const q of [undefined, null, '', 12, {}, []]) {
  test(`rejects an invalid query (${JSON.stringify(q)}) before fetching`, async () => {
    const fetch = mock.fn()
    await assert.rejects(search(q, { fetch }), { message: /Please provide valid search query/ })
    assert.equal(fetch.mock.callCount(), 0)
  })
}

for (const page of [null, '1', 1.5, NaN, Infinity]) {
  test(`rejects an invalid page (${String(page)}) before fetching`, async () => {
    const fetch = mock.fn()
    await assert.rejects(search('fixture', { fetch, page }), { message: /Invalid page/ })
    assert.equal(fetch.mock.callCount(), 0)
  })
}

test('rejects a missing fetch implementation', async () => {
  await assert.rejects(search('fixture', { fetch: null }), { message: /No fetch implementation provided/ })
  assert.equal(nodeFetch.mock.callCount(), 0)
})

test('rejects an unsupported ordering before fetching', async () => {
  const fetch = mock.fn()
  await assert.rejects(search('fixture', { fetch, ordering: 'unknown' }), { message: /Invalid ordering provided/ })
  assert.equal(fetch.mock.callCount(), 0)
})

test('propagates a search request error', async () => {
  const error = new Error('Offline request failure')
  const fetch = mock.fn(() => Promise.reject(error))
  await assert.rejects(search('fixture', { fetch }), actual => actual === error)
})

test('propagates a response body error', async () => {
  const error = new Error('Offline body failure')
  const fetch = mock.fn(() => Promise.resolve({ text: () => Promise.reject(error) }))
  await assert.rejects(search('fixture', { fetch }), actual => actual === error)
})

test('combines a mocked proxy list with fallback URLs and removes duplicates', async () => {
  const fetch = mock.fn(() => Promise.resolve({
    json: () => Promise.resolve({
      proxies: [
        { domain: 'first.example.invalid', secure: true },
        { domain: 'first.example.invalid', secure: true },
        { domain: 'second.example.invalid', secure: false }
      ]
    })
  }))
  const result = await getProxyList({ fetch })
  assert.equal(fetch.mock.callCount(), 1)
  assertCalledWith(fetch, 'https://piratebay-proxylist.se/api/v1/proxies')
  assert.deepEqual(result.slice(0, 2), ['https://first.example.invalid/', 'https://second.example.invalid/'])
  assert.ok(result.length > 2)
  assert.equal(new Set(result).size, result.length)
  assert.equal(nodeFetch.mock.callCount(), 0)
})

test('returns fallback URLs for an empty mocked proxy response', async () => {
  nodeFetch.mock.mockImplementation(() => Promise.resolve({ json: () => Promise.resolve({ proxies: [] }) }))
  const result = await getProxyList()
  assert.ok(result.length > 0)
  result.forEach(url => assert.equal(typeof url, 'string'))
  assert.equal(new Set(result).size, result.length)
})

test('propagates a proxy-list request error', async () => {
  const error = new Error('Offline proxy-list failure')
  const fetch = mock.fn(() => Promise.reject(error))
  await assert.rejects(getProxyList({ fetch }), actual => actual === error)
})

test('propagates a proxy-list JSON error', async () => {
  const error = new Error('Offline JSON failure')
  const fetch = mock.fn(() => Promise.resolve({ json: () => Promise.reject(error) }))
  await assert.rejects(getProxyList({ fetch }), actual => actual === error)
})

test('checks status boundaries with mocked HEAD requests', async () => {
  nodeFetch.mock.mockImplementation(() => Promise.resolve({ json: () => Promise.resolve({ proxies: [] }) }))
  const statuses = [199, 200, 299, 300, 399, 400, 500]
  const urls = statuses.map(status => `https://status-${status}.example.invalid`)
  const fetch = mock.fn(url => Promise.resolve({ status: statuses[urls.indexOf(url)] || 503 }))
  const result = await checkIsUp({ fetch, urls })
  assert.deepEqual(result.slice(0, statuses.length), statuses.map((status, index) => ({
    url: urls[index], up: status >= 200 && status < 400
  })))
  assert.equal(result.slice(statuses.length).every(item => item.up === false), true)
  assert.equal(fetch.mock.callCount(), result.length)
  result.forEach(({ url }) => assertCalledWith(fetch, url, { method: 'HEAD' }))
  assert.equal(nodeFetch.mock.callCount(), 1)
})

test('uses the default fetch for offline availability checks', async () => {
  nodeFetch.mock.mockImplementation((url, options) => options
    ? Promise.resolve({ status: 200 })
    : Promise.resolve({ json: () => Promise.resolve({ proxies: [] }) }))
  const result = await checkIsUp()
  assert.deepEqual(result[0], { url: 'https://thepiratebay.org', up: true })
  assert.equal(result.every(item => item.up), true)
  assert.equal(nodeFetch.mock.callCount(), result.length + 1)
})

test('returns unavailable when mocked HEAD requests exceed the timeout', async () => {
  nodeFetch.mock.mockImplementation(() => Promise.resolve({ json: () => Promise.resolve({ proxies: [] }) }))
  let started
  const requestStarted = new Promise(resolve => { started = resolve })
  const fetch = mock.fn(() => {
    started()
    return new Promise(() => {})
  })
  const pending = checkIsUp({ fetch, urls: ['https://timeout.example.invalid'], wait: 25 })
  await requestStarted
  mock.timers.tick(25)
  const result = await pending
  assert.deepEqual(result[0], { url: 'https://timeout.example.invalid', up: false })
  assert.equal(result.every(item => item.up === false), true)
})

test('propagates a mocked HEAD request rejection', async () => {
  nodeFetch.mock.mockImplementation(() => Promise.resolve({ json: () => Promise.resolve({ proxies: [] }) }))
  const error = new Error('Offline HEAD failure')
  const fetch = mock.fn(() => Promise.reject(error))
  await assert.rejects(checkIsUp({ fetch, urls: ['https://error.example.invalid'] }), actual => actual === error)
})

test('propagates proxy-list failure before attempting HEAD requests', async () => {
  const error = new Error('Offline proxy discovery failure')
  nodeFetch.mock.mockImplementation(() => Promise.reject(error))
  const fetch = mock.fn()
  await assert.rejects(checkIsUp({ fetch }), actual => actual === error)
  assert.equal(fetch.mock.callCount(), 0)
})
