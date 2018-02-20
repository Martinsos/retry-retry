const retry = require('./retry-retry')
const perf_hooks = require('perf_hooks')

/**
 * Helper method for creating and monitoring a task.
 * Creates task that returns promise. It will first fail numFails times,
 * and then it will succeed with the resolveValue or fail with rejectError, depends on
 * which of those you specified.
 * @param {integer} numFails  How many times will the task run before it resolves/rejects.
 * @param {any} resolveValue  If given, it will resolve with it after numFails tries.
 * @param {any} rejectError  If given and resolveValue is not given, it will reject with it after
 *     numFails tries.
 * @return {task, stats}  Task is function, while stats is object that is modified in real time
 *     with the info on the execution of task.
 */
const createPromiseTask = (numFails, resolveValue, rejectError) => {
  const stats = {
    numTries: 0
  }
  const task = async () => {
    stats.numTries++
    if (numFails > 0) {
      numFails--
      throw retry.Retry
    }
    if (resolveValue) {
      return resolveValue
    }
    if (rejectError) {
      throw rejectError
    }
  }
  return {task, stats}
}

test('works for promise-task with no params that is resolved with value', async () => {
  expect.assertions(2)

  const { task, stats } = createPromiseTask(0, 42)
  const result = await retry(task)

  expect(result).toEqual(42)
  expect(stats.numTries).toEqual(1)
})

test('works for promise-task with no params that is rejected with error', async () => {
  expect.assertions(2)

  const error = 'this is an error'
  const { task, stats } = createPromiseTask(0, null, error)
  try {
    await retry(task)
  } catch (e) {
    expect(e).toEqual(error)
  }
  expect(stats.numTries).toEqual(1)
})

test('works for promise-task with no params that retries multiple times', async () => {
  expect.assertions(2)

  const { task, stats } = createPromiseTask(5, 42)
  const result = await retry(task)

  expect(result).toEqual(42)
  expect(stats.numTries).toEqual(6)
})

test('works for promise-task with linear retry strategy', async () => {
  expect.assertions(4)

  const { task, stats } = createPromiseTask(2, 42)
  const startTime = performance.now()
  const result = await retry(task, { pauseMs: 50 })  // Linear strategy is default.
  const totalTime = performance.now() - startTime

  expect(result).toEqual(42)
  expect(stats.numTries).toEqual(3)
  expect(totalTime).toBeLessThan(150)
  expect(totalTime).toBeGreaterThan(90)
})

test('works for promise-task with exponential retry strategy', async () => {
  expect.assertions(4)

  const { task, stats } = createPromiseTask(2, 42)
  const startTime = performance.now()
  const result = await retry(task, { pauseMs: 50, retryStrategy: 'exponential' })
  const totalTime = performance.now() - startTime

  expect(result).toEqual(42)
  expect(stats.numTries).toEqual(3)
  expect(totalTime).toBeLessThan(200)
  expect(totalTime).toBeGreaterThan(140)
})

test('works for promise-task with custom retry strategy', async () => {
  expect.assertions(4)

  const { task, stats } = createPromiseTask(3, 42)
  const startTime = performance.now()
  const result = await retry(task, { pauseMs: 314, retryStrategy: (numTries) => {
    return numTries % 2 ? 50 : 100
  }})
  const totalTime = performance.now() - startTime

  expect(result).toEqual(42)
  expect(stats.numTries).toEqual(4)
  expect(totalTime).toBeLessThan(250)
  expect(totalTime).toBeGreaterThan(190)
})

// TODO(martin): test retryOn

test('rejects with LimitReached error for promise-task that retries too many times', async () => {
  expect.assertions(2)

  const { task, stats } = createPromiseTask(10, 42)
  try {
    const result = await retry(task, { maxTries: 5 })
  } catch (e) {
    expect(e).toEqual(retry.LimitReached)
  }
  expect(stats.numTries).toEqual(5)
})

test('rejects with LimitReached error for promise-task that takes too long', async () => {
  expect.assertions(4)

  const { task, stats } = createPromiseTask(5, 42)
  const startTime = performance.now()
  try {
    const result = await retry(task, {
      pauseMs: 50,
      maxTotalTimeMs: 125
    })
  } catch (e) {
    expect(e).toEqual(retry.LimitReached)
  }
  const totalTime = performance.now() - startTime

  expect(stats.numTries).toEqual(3)
  expect(totalTime).toBeLessThan(140)
  expect(totalTime).toBeGreaterThan(90)
})
