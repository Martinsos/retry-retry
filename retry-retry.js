
/**
 * Picks best avaiable function for measuring current time, tailored for performance measurement.
 * @return Current time in milliseconds.
 */
const chooseBestTimeNowMsFunction = () => {
  if (window && window.performance && window.performance.now) {  // Browser
    return () => window.performance.now()
  }
  if (require) {  // Nodejs
    const perf_hooks = require('perf_hooks')
    if (perf_hooks && perf_hooks.performance && perf_hooks.performance.now) {
      return () => perf_hooks.performance.now()
    }
  }
  if (process && process.hrtime) {  // Nodejs
    return () => {
      const [s, ns] = process.hrtime()
      return Math.round(s * 1000 + ns / 1000000)
    }
  }
  return () => Date.getTime()  // Universal
}

const timeNowMs = chooseBestTimeNowMsFunction()

/**
 * Tries to execute given task repeatedly until the task succeeds, fails, or until retry limit
 * (number of tries or total time) is reached.
 *
 * @param {function(retry)} task  Function that receives retry() callback and returns promise.
 *     If promise is resolved without retry() having been called, task succeded, retrying stopped
 *     and result is propagated.
 *     If promise is resolved with retry() having been called at least once, task is retried.
 *     If promise is rejected, task failed, retrying is stopped and error is propagated.
 * @param {Object} params  Additional options.
 *     - {Integer} pauseMs  Pause between the end of the last try and the start of the next try,
 *           in milliseconds. This is default behaviour, but it might be modified with
 *           retryStrategy option. Has to be non-negative. Default is 0.
 *     - {Integer} maxTries  Number of tries after which retrying will stop.
 *           Has to be non-negative. Default is 0, which means there is no limit on number of tries.
 *     - {Integer} maxTotalTimeMs  If more than maxTotalTimeMs milliseconds has elapsed since the first
 *           try started, retrying will stop. Has to be non-negative. Default is 0, which means
 *           there is no time limit.
 *     - {Object} errorOnLimit  Error that will be returned if limit (maxTries or maxTotalTime)
 *           is reached. Default is { retryLimitReached: true }.
 *     - {String || function} retryStrategy  Strategy that will be used to determine pause
 *           between two consecutive tries. Possible values:
 *           - 'linear'  This is default strategy. Same pause of pauseMs milliseconds is always
 *                 taken between two tries.
 *           - 'exponential'  First pause is pauseMs milliseconds, second is 2 * pauseMs, ...,
 *                 and N-th is 2^N * pauseMs.
 *           - {function(numTries)}  Function that takes number of tries so far and returns
 *                 pause in milliseconds from the end of last try until the start of next try.
 *                 So after first try numTries will be 1.
 *     You can define one retry limit, none of them, or both: when at least one of them is reached,
 *     retrying is stopped.
 * @return {Promise}  If tasks was successfuly done, this promise is resolved with the same value
 *     that task's promise was resolved with.
 *     If task's promise was rejected with an error, this promise is rejected with that same error.
 *     If retry limit was reached, this promise is rejected with errorOnLimit error.
 */
const retry = async (task, params = {}) => {
  if (typeof task !== 'function') throw { error: 'Parameter "task" must be a function.' }

  // Unpack parameters and set them to their default values if they are not provided.
  const pauseMs = Math.max(0, params.pauseMs) || 0
  const maxTries = Math.max(0, params.maxTries) || 0
  const maxTotalTimeMs = Math.max(0, params.maxTotalTimeMs) || 0
  const errorOnLimit = params.errorOnLimit || { retryLimitReached: true }
  const retryStrategy = params.retryStrategy || 'linear'

  const startTimeMs = timeNowMs()
  for (let tryIdx = 0; maxTries == 0 || tryIdx < maxTries; tryIdx++) {
    let retry = false

    taskResult = await task(() => retry = true)

    if (!retry) {
      return taskResult  // Propagate the result. We are done, task was successful!
    }

    // Task asked for a retry, so let's retry!
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
    await new Promise(resolve => setTimeout(resolve, actualPauseMs))
  }

  throw errorOnLimit
}

module.exports = retry
