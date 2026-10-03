jest.mock('node-fetch', () => jest.fn(() => {
  throw new Error('Unexpected fetch: tests must provide an offline response')
}))

const nodeFetch = require('node-fetch')
const api = require('../')
const {getProxyList, search, checkIsUp} = api

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
  nodeFetch.mockReset()
  nodeFetch.mockImplementation(() => {
    throw new Error('Unexpected fetch: tests must provide an offline response')
  })
  jest.useFakeTimers()
})

afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
})

test('exports the supported public functions', () => {
  expect(Object.keys(api).sort()).toEqual(['checkIsUp', 'getProxyList', 'search'])
  Object.keys(api).forEach(name => expect(typeof api[name]).toBe('function'))
})

test('parses only named result rows into the public result shape', async () => {
  const text = jest.fn(() => Promise.resolve(html))
  const fetch = jest.fn(() => Promise.resolve({text}))

  await expect(search('synthetic & example', {
    fetch,
    baseURL: 'https://search.example.invalid',
    page: 2,
    ordering: 'uploaded'
  })).resolves.toEqual([
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
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith('https://search.example.invalid/search/synthetic%20%26%20example/2/3/0')
  expect(text).toHaveBeenCalledTimes(1)
  expect(nodeFetch).not.toHaveBeenCalled()
})

test('uses the default fetch, page, and ordering with an offline response', async () => {
  nodeFetch.mockResolvedValue({text: () => Promise.resolve('<p>No results</p>')})
  await expect(search('fixture')).resolves.toEqual([])
  expect(nodeFetch).toHaveBeenCalledTimes(1)
  expect(nodeFetch).toHaveBeenCalledWith('https://thepiratebay.org/search/fixture/0/7/0')
})

test.each([
  ['default', 99], ['uploaded', 3], ['size', 5],
  ['uploadedBy', 11], ['seeders', 7], ['leechers', 9]
])('encodes a query and maps %s ordering', async (ordering, value) => {
  const fetch = jest.fn(() => Promise.resolve({text: () => Promise.resolve('')}))
  await expect(search('fixture / café?', {
    fetch, baseURL: 'https://search.example.invalid', ordering
  })).resolves.toEqual([])
  expect(fetch).toHaveBeenCalledWith(`https://search.example.invalid/search/fixture%20%2F%20caf%C3%A9%3F/0/${value}/0`)
})

test.each([[undefined], [null], [''], [12], [{}], [[]]])('rejects an invalid query (%p) before fetching', async q => {
  const fetch = jest.fn()
  await expect(search(q, {fetch})).rejects.toThrow('Please provide valid search query')
  expect(fetch).not.toHaveBeenCalled()
})

test.each([null, '1', 1.5, NaN, Infinity])('rejects an invalid page (%p) before fetching', async page => {
  const fetch = jest.fn()
  await expect(search('fixture', {fetch, page})).rejects.toThrow('Invalid page')
  expect(fetch).not.toHaveBeenCalled()
})

test('rejects a missing fetch implementation', async () => {
  await expect(search('fixture', {fetch: null})).rejects.toThrow('No fetch implementation provided')
  expect(nodeFetch).not.toHaveBeenCalled()
})

test('rejects an unsupported ordering before fetching', async () => {
  const fetch = jest.fn()
  await expect(search('fixture', {fetch, ordering: 'unknown'})).rejects.toThrow('Invalid ordering provided')
  expect(fetch).not.toHaveBeenCalled()
})

test('propagates a search request error', async () => {
  const error = new Error('Offline request failure')
  const fetch = jest.fn(() => Promise.reject(error))
  await expect(search('fixture', {fetch})).rejects.toBe(error)
})

test('propagates a response body error', async () => {
  const error = new Error('Offline body failure')
  const fetch = jest.fn(() => Promise.resolve({text: () => Promise.reject(error)}))
  await expect(search('fixture', {fetch})).rejects.toBe(error)
})

test('combines a mocked proxy list with fallback URLs and removes duplicates', async () => {
  const fetch = jest.fn(() => Promise.resolve({json: () => Promise.resolve({proxies: [
    {domain: 'first.example.invalid', secure: true},
    {domain: 'first.example.invalid', secure: true},
    {domain: 'second.example.invalid', secure: false}
  ]})}))
  const result = await getProxyList({fetch})
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith('https://piratebay-proxylist.se/api/v1/proxies')
  expect(result.slice(0, 2)).toEqual(['https://first.example.invalid/', 'https://second.example.invalid/'])
  expect(result.length).toBeGreaterThan(2)
  expect(new Set(result).size).toBe(result.length)
  expect(nodeFetch).not.toHaveBeenCalled()
})

test('returns fallback URLs for an empty mocked proxy response', async () => {
  nodeFetch.mockResolvedValue({json: () => Promise.resolve({proxies: []})})
  const result = await getProxyList()
  expect(result.length).toBeGreaterThan(0)
  result.forEach(url => expect(typeof url).toBe('string'))
  expect(new Set(result).size).toBe(result.length)
})

test('propagates a proxy-list request error', async () => {
  const error = new Error('Offline proxy-list failure')
  const fetch = jest.fn(() => Promise.reject(error))
  await expect(getProxyList({fetch})).rejects.toBe(error)
})

test('propagates a proxy-list JSON error', async () => {
  const error = new Error('Offline JSON failure')
  const fetch = jest.fn(() => Promise.resolve({json: () => Promise.reject(error)}))
  await expect(getProxyList({fetch})).rejects.toBe(error)
})

test('checks status boundaries with mocked HEAD requests', async () => {
  nodeFetch.mockResolvedValue({json: () => Promise.resolve({proxies: []})})
  const statuses = [199, 200, 299, 300, 399, 400, 500]
  const urls = statuses.map(status => `https://status-${status}.example.invalid`)
  const fetch = jest.fn(url => Promise.resolve({status: statuses[urls.indexOf(url)] || 503}))
  const result = await checkIsUp({fetch, urls})
  expect(result.slice(0, statuses.length)).toEqual(statuses.map((status, index) => ({
    url: urls[index], up: status >= 200 && status < 400
  })))
  expect(result.slice(statuses.length).every(item => item.up === false)).toBe(true)
  expect(fetch).toHaveBeenCalledTimes(result.length)
  result.forEach(({url}) => expect(fetch).toHaveBeenCalledWith(url, {method: 'HEAD'}))
  expect(nodeFetch).toHaveBeenCalledTimes(1)
})

test('uses the default fetch for offline availability checks', async () => {
  nodeFetch.mockImplementation((url, options) => options
    ? Promise.resolve({status: 200})
    : Promise.resolve({json: () => Promise.resolve({proxies: []})}))
  const result = await checkIsUp()
  expect(result[0]).toEqual({url: 'https://thepiratebay.org', up: true})
  expect(result.every(item => item.up)).toBe(true)
  expect(nodeFetch).toHaveBeenCalledTimes(result.length + 1)
})

test('returns unavailable when mocked HEAD requests exceed the timeout', async () => {
  nodeFetch.mockResolvedValue({json: () => Promise.resolve({proxies: []})})
  let started
  const requestStarted = new Promise(resolve => { started = resolve })
  const fetch = jest.fn(() => {
    started()
    return new Promise(() => {})
  })
  const pending = checkIsUp({fetch, urls: ['https://timeout.example.invalid'], wait: 25})
  await requestStarted
  jest.advanceTimersByTime(25)
  const result = await pending
  expect(result[0]).toEqual({url: 'https://timeout.example.invalid', up: false})
  expect(result.every(item => item.up === false)).toBe(true)
})

test('propagates a mocked HEAD request rejection', async () => {
  nodeFetch.mockResolvedValue({json: () => Promise.resolve({proxies: []})})
  const error = new Error('Offline HEAD failure')
  const fetch = jest.fn(() => Promise.reject(error))
  await expect(checkIsUp({fetch, urls: ['https://error.example.invalid']})).rejects.toBe(error)
})

test('propagates proxy-list failure before attempting HEAD requests', async () => {
  const error = new Error('Offline proxy discovery failure')
  nodeFetch.mockRejectedValue(error)
  const fetch = jest.fn()
  await expect(checkIsUp({fetch})).rejects.toBe(error)
  expect(fetch).not.toHaveBeenCalled()
})
