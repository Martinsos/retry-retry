
/**
 * Tries to execute given task repeatedly until the task succeeds.
 * Task is a function that returns promise. If promise is resolved, task succeded.
 * If promise is rejected with falsy error, task is retried.
 * If promise is rejected with truthy error, task is not retried and error is propagated (as promise reject).
 * If max number of retries is exceeded, returned promise is rejected.
 * @param {func()} task  Function that returns promise.
 * @param {Integer} pause  Pause between end of previous and start of next try, in miliseconds.
 * @param {Integer} numTries  Number of retries before we give up.
 * @return {Promise}  If tasks's promise is resolved, this promise is resolved with same value.
 *     If tasks's promise is rejected with thruthy error e, this promise is rejected with
 *     { timeout: false, error: e }
 *     If max number of tries is exceeded, this promise is rejected with { timeout: true }
 */
const retry = async (task, pause, numTries) => {
  for (let i = 0; i < numTries; i++) {
    try {
      return await task()
    } catch (error) {
      if (error) {
        throw { timeout: false, error }  // If truthy error, propagate it.
      } else {
        await new Promise(resolve => setTimeout(resolve, pause))  // If falsy error, take a pause and then retry.
      }
    }
  }
  throw { timeout: true, error: null }
}

module.exports = retry
