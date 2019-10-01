const cheerio = require('cheerio')
const nodeFetch = require('node-fetch')

const proxies = [
  'https://pirateproxy.cam',
  'https://piratebay2.org',
  'https://thehiddenbay.com',
  'https://thepiratebay.wtf',
  'https://piratebay.kim/',
  'https://tpb.lc/',
  'https://thepiratebay.sh/',
  'https://pirateproxy.tel/',
  'https://bayproxy.click/',
  'https://piratebays.red/',
  'https://thepiratebay.love/',
  'https://thepiratebay.nz/',
  'https://piratebays.one/',
  'https://piratebays.pw/',
  'https://proxyproxy.org/',
  'https://piratepirate.be/',
  'https://proxybay.tel/',
  'https://tpbproxy.bz/',
  'https://baypirate.org/',
  'https://bayproxy.club/',
  'https://proxybay.nu/',
  'https://piratebays.click/',
  'https://pirateproxy.be/',
  'https://piratebay-proxylist.se/',
  'https://pirateproxy.wtf/',
  'https://www.pirateproxy.space/',
  'https://proxybay.live/',
  'https://tpbproxy.nl/'
]

const orderingMap = {
  'default': 99,
  'uploaded': 3,
  'size': 5,
  'uploadedBy': 11,
  'seeders': 7,
  'leechers': 9
}

function getProxyList({fetch = nodeFetch} = {}) {
  return fetch('https://piratebay-proxylist.se/api/v1/proxies')
    .then(res => res.json())
    .then(json => json.proxies.map(proxy => `${proxy.secure ? 'https' : 'https'}://${proxy.domain}/`) || [])
    .then(domains => [...new Set(domains.concat(proxies))])
    .catch(err => {
      throw err;
    })
}

function isUp (url, {fetch = nodeFetch, wait = 2000} = {}) {
  return new Promise((resolve, reject) => {
    fetch(url, {method: 'HEAD'}).then(res => {
      resolve({url, up: res.status >= 200 && res.status < 400})
    })
    .catch(reject)

    setTimeout(() => resolve({url, up: false}), wait)
  })
}

async function checkIsUp ({fetch = nodeFetch, wait = 2000, urls = ['https://thepiratebay.org']} = {}) {
  const proxyList = await getProxyList();
  const proxyPromises = urls.concat(proxyList).map(url => isUp(url, {fetch, wait}))
  return Promise.all(proxyPromises)
}

async function search (q = '', {fetch = nodeFetch, baseURL = 'https://thepiratebay.org', page = 0, ordering = 'seeders'} = {}) {
  if (!fetch) {
    throw new Error('piratebay-search: No fetch implementation provided')
  }

  if (!q || typeof q !== 'string' || q.length === 0) {
    throw new Error('piratebay-search: Please provide valid search query')
  }

  if (page === undefined || !Number.isInteger(page)) {
    throw new Error(`piratebay-search: Invalid page of ${page} provided`)
  }

  if (!orderingMap[ordering]) {
    throw new Error(`piratebay-search: Invalid ordering provided. Should be ${Object.keys(orderingMap).join(', ')}`)
  }

  const url = `${baseURL}/search/${encodeURIComponent(q)}/${page}/${orderingMap[ordering]}/0`
  const res = await fetch(url)
  const text = await res.text()

  const $ = cheerio.load(text)

  const torrents = []

  $("table[id='searchResult'] tr").each(function () {
    const torrent = {
      name: $(this).find('a.detLink').text(),
      link: $(this).find('a.detLink').attr('href'),
      seeds: $(this).children('td:nth-child(3)').text(),
      peers: $(this).children('td:nth-child(4)').text(),
      description: $(this).find('font.detDesc').text(),
      file: $(this).find('a[href^="magnet"]').attr('href')
    }

    if (torrent.name.length) {
      torrents.push(torrent)
    }
  })

  return torrents
}

module.exports = {
  getProxyList,
  checkIsUp,
  search
}
