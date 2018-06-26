const {proxies, search, checkIsUp} = require('../')

test('should list proxies', () => {
  expect(Array.isArray(proxies)).toBeTruthy()
})

test('should search piratebay', async () => {
  const result = await search('ubuntu', {baseURL: 'https://thehiddenbay.com'})
  expect(Array.isArray(result))
})

test('should check if proxies are up', async () => {
  const result = await checkIsUp()
  expect(Array.isArray(result))
})
