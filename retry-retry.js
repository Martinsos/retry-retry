
// TODO: Make it give up if there is too much of unexpected errors. Hm I actually already have that.
//   Density?

/**
 * TODO
 */
const chooseBestTimeNowMsFunction = () => {
  if (window && window.performance && window.performance.now) {
    return () => window.performance.now()
  }

  if (require) {
    const perf_hooks = require('perf_hooks')
    if (perf_hooks && perf_hooks.performance && perf_hooks.performance.now) {
      return () => perf_hooks.performance.now()
    }

    if (process && process.hrtime) {
      return () => {
        const [s, ns] = process.hrtime()
        return Math.round(s * 1000 + ns / 1000000)
      }
    }
  }

  return () => Date.getTime()
}

const timeNowMs = chooseBestTimeNowMsFunction()

/**
 * TODO: update summary.
 * Tries to execute given task repeatedly until the task succeeds.
 * Task is a function that returns promise. If promise is resolved, task succeded.
 * If promise is rejected with falsy error, task is retried.
 * If promise is rejected with truthy error, task is not retried and error is propagated (as promise reject).
 * If max number of retries is exceeded, returned promise is rejected.
 * @param {function} task  Function that returns promise.
 * @param {Object} params  Additional options.
 *     - {Integer} pauseMs  Pause between the end of the last try and the start of the next try,
 *           in milliseconds. This is default behaviour, but it might be modified with
 *           retryStrategy option. Has to be non-negative. Default is 0.
 *     - {Integer} maxRetries  Number of retries after which retrying will stop.
 *           Has to be non-negative. Default is 0, which means there is no limit on number of retries.
 *     - {Integer} maxTotalTimeMs  If more than maxTotalTimeMs milliseconds has elapsed since the first
 *           try started, retrying will stop. Has to be non-negative. Default is 0, which means
 *           there is no time limit.
 *     - {Object} errorOnLimit  Error that will be returned if limit (maxRetries or maxTotalTime)
 *           is reached. Default is { retryLimitReached: true }.
 *     - {String || function} retryStrategy  Strategy that will be used to determine time
 *           between two consecutive tries. Possible values:
 *           - 'linear'  This is default strategy. Same pause of pauseMs milliseconds is always
 *                 taken between two tries.
 *           - 'exponential'  First pause is 2 * pauseMs milliseconds, second is 2^2 * pauseMs, ...,
 *                 and N-th is 2^N * pauseMs.
 *           - {function(numTries)}  Function that takes number of tries so far and returns
 *                 pause in milliseconds from the end of last try until the start of next try.
 *                 So after first try numTries will be 1.
 *     You can define only one limit, none of them, or both: when at least one of them is reached,
 *     retrying is stopped.
 * TODO: update return documentation.
 * @return {Promise}  If tasks's promise is resolved, this promise is resolved with same value.
 *     If tasks's promise is rejected with thruthy error e, this promise is rejected with
 *     { timeout: false, error: e }
 *     If max number of tries is exceeded, this promise is rejected with { timeout: true }
 */
const retry = async (task, params = {}) => {
  if (typeof task !== 'function') throw { error: 'Parameter "task" must be a function.' }

  // Unpack parameters and set them do their default values if they are not provided.
  const pauseMs = params.pauseMs || 0
  const maxRetries = params.maxRetries || 0
  const maxTotalTimeMs = params.maxTotalTimeMs || 0
  const errorOnLimit = params.errorOnLimit || { retryLimitReached: true }
  const retryStrategy = params.retryStrategy || 'linear'

  const startTimeMs = timeNowMs()
  for (let tryIdx = 0; maxRetries == 0 || tryIdx < maxRetries; tryIdx++) {
    let retry = false
    // TODO: make it work if not promise.
    taskResult = await task(() => retry = true)
    if (!retry) {
      return taskResult  // Propagate the result. We are done, task was successful!
    } else {  // Retry.
      // Determine the actual pause based on retry strategy.
      let actualPauseMs = 0
      if (retryStrategy == 'linear') actualPauseMs = pauseMs
      else if (retryStrategy == 'exponential') actualPauseMs = Math.pow(2, tryIdx) * pauseMs
      else actualPauseMs = Math.max(0, retryStrategy(tryIdx + 1))

      // Check if we should stop due to time limit.
      if (maxTotalTimeMs > 0) {
        const elapsedTimeMs = timeNowMs() - startTimeMs
        if (elapsedTimeMs + actualPauseMs > maxTotalTimeMs) {
          throw errorOnLimit
        }
      }

      // Take a pause and then retry.
      await new Promise(resolve => setTimeout(resolve, pauseMs))
    }
  }

  throw errorOnLimit
}

module.exports = retry
