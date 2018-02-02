const retry = require('./retry-retry')

test('works for task that returns resolved promise', async () => {
  expect.assertions(1)
  expect(await retry(async () => 42, 1000, 2)).toEqual(42)
})
