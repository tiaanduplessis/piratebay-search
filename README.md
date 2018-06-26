
# piratebay-search
[![package version](https://img.shields.io/npm/v/piratebay-search.svg?style=flat-square)](https://npmjs.org/package/piratebay-search)
[![package downloads](https://img.shields.io/npm/dm/piratebay-search.svg?style=flat-square)](https://npmjs.org/package/piratebay-search)
[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)
[![package license](https://img.shields.io/npm/l/piratebay-search.svg?style=flat-square)](https://npmjs.org/package/piratebay-search)
[![make a pull request](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

> Quickly search Piratebay 🏴‍☠️

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [License](#License)

## Install

This project uses [node](https://nodejs.org) and [npm](https://www.npmjs.com). 

```sh
$ npm install piratebay-search
$ # OR
$ yarn add piratebay-search
```

## Usage

```js
const { search, checkIsUp, proxies } = require('piratebay-search')

search('Ubuntu', {
  baseURL: 'https://thehiddenbay.com', // default https://thepiratebay.org
  page: 0, // default 0
  ordering: 'uploaded' // default 'seeders'. Options are 'default', 'uploaded', 'size', 'uploadedBy', 'seeders' and 'leechers'
}).then(console.log).catch(console.error)
// [ { name: 'Ubuntu 16.04.1 LTS Desktop 64-bit',
//     link:
//      'https://thehiddenbay.com/torrent/15496322/Ubuntu_16.04.1_LTS_Desktop_64-bit',
//     seeds: '48',
//     peers: '2',
//     description: 'Uploaded 08-06 2016, Size 1.41 GiB, ULed by  SeuPirate ',
//     file:
//      'magnet:?xt=urn:btih:9f9165d9a281a9b8e782cd5176bbcc8256fd1871&dn=Ubuntu+16.04.1+LTS+Desktop+64-bit&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80&tr=udp%3A%2F%2Ftracker.publicbt.com%3A80&tr=udp%3A%2F%2Ftracker.ccc.de%3A80' }, ...]

checkIsUp().then(console.log).catch(console.error)
// [ { url: 'https://thepiratebay.org', up: false },
//   { url: 'https://pirateproxy.cam', up: false },
//   { url: 'https://piratebay2.org/', up: true },
//   { url: 'https://thehiddenbay.com', up: true } ]

console.log(proxies)
// [
//     'https://pirateproxy.cam',
//     'https://piratebay2.org',
//     'https://thehiddenbay.com',
//     ...
// ] Still need to add a couple more

```

## Contribute

1. Fork it and create your feature branch: git checkout -b my-new-feature
2. Commit your changes: git commit -am 'Add some feature'
3. Push to the branch: git push origin my-new-feature 
4. Submit a pull request

## License

MIT
    