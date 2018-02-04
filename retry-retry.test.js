const retry = require('./retry-retry')

test('works for task that returns resolved promise', async () => {
  expect.assertions(1)
  expect(await retry(async (retry) => 42)).toEqual(42)
})
