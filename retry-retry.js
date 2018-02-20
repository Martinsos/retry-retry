(function () {
"use strict"
/**
 * Library for easy retrying of tasks (task is a function that returns promise).
 * @module retry-retry
 */

/**
 * Picks best avaiable function for measuring current time, tailored for performance measurement.
 *
 * @returns {integer} Current time in milliseconds.
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

/**
 * Tries to execute given task repeatedly until the task succeeds, fails, or until retry limit
 * (number of tries or total time) is reached.
 * @alias module:retry-retry
 *
 * @param {function():Promise} task - Function that returns promise.
 *     If that promise is resolved, task succeded, retrying stops and result is propagated.
 *     If that promise is rejected with `retry.Retry` (or some other chosen error,
 *       see `params.retryOn`), task is retried.
 *     If that promise is rejected with any other error, task failed, retrying stops and error is
 *       propagated.
 *
 * @param {object} [params] - Additional options. Optional.
 * @param {integer} [params.pauseMs] - Pause between the end of the last try and the start of the next try,
 *     in milliseconds. This is default behaviour, but it might be modified with `retryStrategy`
 *     option. Has to be non-negative. Default is 0.
 * @param {integer} [params.maxTries] - Retry limit. Number of tries after which retrying will stop.
 *     Has to be non-negative. Default is 0, which means there is no limit on number of tries.
 * @param {integer} [params.maxTotalTimeMs] - Retry limit. If more than `maxTotalTimeMs` milliseconds
 *     has elapsed since the first try started, retrying will stop. Has to be non-negative.
 *     Default is 0, which means there is no time limit.
 * @param {function(object):boolean} [params.retryOn] - Function that takes error with which promise was
 *     rejected and returns true if task should be repeated or false if error should be propagated.
 *     This way you can trigger retry on different errors than just `retry.Retry`.
 *     By default, it is `(e) => e === retry.Retry`.
 * @param {string|function(integer):integer} [params.retryStrategy] - Strategy that will be used to
 *     determine pause between two consecutive tries. Possible values:
 *       - `'linear'` - This is default strategy. Same pause of `pauseMs` milliseconds is always
 *           taken between two tries.
 *       - `'exponential'` - First pause is `pauseMs` milliseconds, second is 2 * `pauseMs`, ...,
 *           and N-th is 2^N * `pauseMs`.
 *       - Function that takes number of tries so far and returns pause in milliseconds from the
 *           end of last try until the start of next try. So after first try `numTries` will be 1.
 *           This allows you to define your custom strategy.
 *
 * @returns {Promise}  Resolved with task's value on task success or rejected with task's error on
 *     task failure. Rejected with `retry.LimitReached` if one of retry limits was reached.
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

// Export module, through module system if it exists, otherwise through window object.
if (typeof exports !== 'undefined') {
  if (typeof module !== 'undefined' && module.exports) {
    exports = module.exports = retry
  }
  exports.retry = retry
} else {
  if (window) {
    window['retry-retry'] = retry
  }
}

})()
