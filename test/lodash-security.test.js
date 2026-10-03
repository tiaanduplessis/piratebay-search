const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createRequire } = require('module')
const fromCheerio = createRequire(require.resolve('cheerio/package.json'))
const merge = fromCheerio('lodash/merge')
const unset = fromCheerio('lodash/unset')
const omit = fromCheerio('lodash/omit')
const template = fromCheerio('lodash/template')
const fromPairs = fromCheerio('lodash/fromPairs')

// These synthetic dependency probes do not model an exploit through search().
// Fresh private constructors keep built-in prototypes untouched.
test('merge does not modify a private constructor prototype', () => {
  function FixtureCtor () {}
  merge({ constructor: FixtureCtor }, { constructor: { prototype: { sentinel: true } } })
  assert.equal(Object.prototype.hasOwnProperty.call(FixtureCtor.prototype, 'sentinel'), false)
})

const paths = [
  ['ordinary', 'constructor.prototype.sentinel'],
  ['array-wrapped', [['constructor'], ['prototype'], 'sentinel']]
]

for (const [kind, path] of paths) {
  test(`unset preserves a private prototype sentinel for ${kind} paths`, () => {
    function FixtureCtor () {}
    FixtureCtor.prototype.sentinel = 'preserved'
    unset({ constructor: FixtureCtor }, path)
    assert.equal(FixtureCtor.prototype.sentinel, 'preserved')
  })
}

for (const [kind, path] of paths) {
  test(`omit preserves a private prototype sentinel for ${kind} paths`, () => {
    function FixtureCtor () {}
    FixtureCtor.prototype.sentinel = 'preserved'
    omit({ constructor: FixtureCtor }, [path])
    assert.equal(FixtureCtor.prototype.sentinel, 'preserved')
  })
}

test('template rejects a variable containing a harmless default expression', () => {
  assert.throws(() => template('fixture', { variable: 'data = 1' }))
})

test('template rejects an imports key containing a harmless default expression', () => {
  assert.throws(() => template('fixture', { imports: { 'entry = 1': 1 } }))
})

test('modular template compiles ordinary interpolation and imports', () => {
  const render = template('<%= label(data.name) %>', {
    variable: 'data', imports: { label: name => `Hello ${name}` }
  })
  assert.equal(render({ name: 'fixture' }), 'Hello fixture')
})

test('modular fromPairs builds an ordinary object', () => {
  assert.deepEqual(fromPairs([['name', 'fixture'], ['count', 2]]), { name: 'fixture', count: 2 })
})
