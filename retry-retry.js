(function () {
"use strict"

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

// Singleton object. If promise is rejected with it, it is recognized as signal to retry the task.
const Retry = Object.freeze({})
// Singleton object. retry() is rejected with it if limit (time or num tries) is reached.
const LimitReached = Object.freeze({})

// TODO(martin): update readme.
/**
 * Tries to execute given task repeatedly until the task succeeds, fails, or until retry limit
 * (number of tries or total time) is reached.
 *
 * @param {function(retry)} task  Function that receives retry() callback and returns promise.
 *     If task is resolved, task succeded, retrying stops and result is propagated.
 *     If task is rejected with retry.Retry (or some other chosen error, see retryOn param),
 *       task is retried.
 *     If task is rejected with any other error, task failed, retrying stops and error is
 *       propagated.
 *     If limit (maxTries or maxTotalTime) is reached, task failed, retrying stops and promise is
 *       rejected with retry.LimitReached.
 * @param {Object} params  Additional options.
 *     - {Integer} pauseMs  Pause between the end of the last try and the start of the next try,
 *           in milliseconds. This is default behaviour, but it might be modified with
 *           retryStrategy option. Has to be non-negative. Default is 0.
 *     - {Integer} maxTries  Retry limit. Number of tries after which retrying will stop.
 *           Has to be non-negative. Default is 0, which means there is no limit on number of tries.
 *     - {Integer} maxTotalTimeMs  Retry limit. If more than maxTotalTimeMs milliseconds has elapsed
 *            since the first try started, retrying will stop. Has to be non-negative.
 *            Default is 0, which means there is no time limit.
 *     - {func(error)} retryOn  Function that takes error with which promise was rejected and
 *           returns true if task should be repeated or false if error should be propagated.
 *           This way you can trigger retry on different errors than just retry.Retry.
 *           By default, it is (e) => e === retry.Retry.
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
 * @return {Promise}  Resolved with taskss value on task success or reject with task's error on task
 *     failure. Rejected with retry.LimitReached if one of retry limits was reached.
 */
const retry = async (task, params = {}) => {
  if (typeof task !== 'function') throw { error: 'Parameter "task" must be a function.' }

  // Unpack parameters and set them to their default values if they are not provided.
  const pauseMs = Math.max(0, params.pauseMs) || 0
  const maxTries = Math.max(0, params.maxTries) || 0
  const maxTotalTimeMs = Math.max(0, params.maxTotalTimeMs) || 0
  const retryOn = params.retryOn || (e => e === Retry)
  const retryStrategy = params.retryStrategy || 'linear'

  const startTimeMs = timeNowMs()
  for (let tryIdx = 0; maxTries == 0 || tryIdx < maxTries; tryIdx++) {
    // Run the task. If it succeeds, return the resolved value. If it is rejected with
    // error, throw error. If it is rejected with special Retry value, continue with retrying
    // the task.
    try {
      return await task()
    } catch (error) {
      if (!retryOn(error)) {
        throw error
      }
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
        throw LimitReached
      }
    }

    // Take a pause and then retry.
    await new Promise(resolve => setTimeout(resolve, actualPauseMs))
  }

  throw LimitReached
}

// Export Retry and LimitReached through the retry() function, as it's member.
retry.Retry = Retry
retry.LimitReached = LimitReached

module.exports = retry
if (window) window['retry-retry'] = retry
})()
