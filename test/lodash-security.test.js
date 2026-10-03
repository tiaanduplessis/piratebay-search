const {createRequire} = require('module')
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
  merge({constructor: FixtureCtor}, {constructor: {prototype: {sentinel: true}}})
  expect(Object.prototype.hasOwnProperty.call(FixtureCtor.prototype, 'sentinel')).toBe(false)
})

const paths = [
  ['ordinary', 'constructor.prototype.sentinel'],
  ['array-wrapped', [['constructor'], ['prototype'], 'sentinel']]
]

test.each(paths)('unset preserves a private prototype sentinel for %s paths', (kind, path) => {
  function FixtureCtor () {}
  FixtureCtor.prototype.sentinel = 'preserved'
  unset({constructor: FixtureCtor}, path)
  expect(FixtureCtor.prototype.sentinel).toBe('preserved')
})

test.each(paths)('omit preserves a private prototype sentinel for %s paths', (kind, path) => {
  function FixtureCtor () {}
  FixtureCtor.prototype.sentinel = 'preserved'
  omit({constructor: FixtureCtor}, [path])
  expect(FixtureCtor.prototype.sentinel).toBe('preserved')
})

test('template rejects a variable containing a harmless default expression', () => {
  expect(() => template('fixture', {variable: 'data = 1'})).toThrow()
})

test('template rejects an imports key containing a harmless default expression', () => {
  expect(() => template('fixture', {imports: {'entry = 1': 1}})).toThrow()
})

test('modular template compiles ordinary interpolation and imports', () => {
  const render = template('<%= label(data.name) %>', {
    variable: 'data', imports: {label: name => `Hello ${name}`}
  })
  expect(render({name: 'fixture'})).toBe('Hello fixture')
})

test('modular fromPairs builds an ordinary object', () => {
  expect(fromPairs([['name', 'fixture'], ['count', 2]])).toEqual({name: 'fixture', count: 2})
})
