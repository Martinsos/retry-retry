retry-retry
&middot;
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/Martinsos/retry-retry/blob/master/LICENSE)
[![npm version](https://img.shields.io/npm/v/retry-retry.svg?style=flat)](https://www.npmjs.com/package/retry-retry)
[![Travis CI (master branch)](https://img.shields.io/travis/Martinsos/retry-retry/master.svg?label=travis%20ci)](https://travis-ci.org/Martinsos/retry-retry)
[![Coverage Status](https://img.shields.io/coveralls/Martinsos/retry-retry/master.svg?style=flat)](https://coveralls.io/github/Martinsos/retry-retry?branch=master)
=====

Javascript library for easy retrying of tasks (task is just a function that returns promise).

Simple example (polling for a resource that is about to become ready):
```js
const retry = require('retry-retry')

const resource = await retry(yourResourceFetchingPromiseReturningFunction, {
  pauseMs: 1000, maxTotalTimeMs: 3 * 60 * 1000, retryOn: e => e === 'YourResourceIsNotYetReady'
})
```

## Features
- Promise based.
- Very simple but flexible interface.
- Supports setting limit on total elapsed time and / or max number of tries.
- Supports linear, exponential or custom retry strategy (duration of pauses between tries).
- Easily trigger retry by throwing special error or by catching specific errors of your choice.
- No external dependencies.
- Has fun name.


## Including in your project
retry-retry is available on npm, so just install it with
```
npm install -S retry-retry
```

There is only one main function, `retry`, which you can import in your code with
```js
const retry = require('retry-retry')
```
or if you have ES6 modules enabled, with
```js
import retry from 'retry-retry'
```

In case you use `script` tag to include retry-retry, retry-retry sets `window['retry-retry']`
to `retry()` function (if there is a window object), so you can access it like this:
```js
const retry = window['retry-retry']
```

## Usage and examples

retry-retry has only one public function: `retry`.

In order to retry your promise returning function (task) many times, you just pass it to `retry`,
specify some extra parameters if you wish and that is it.

If promise that your task returns resolves, it is done and result is propagated through promise
that `retry` returns.
If it is rejected instead, it fails and error is propagated.
However, if it is rejected with special error `retry.Retry`, task will be retried!

That is it! Check examples below and API for more details.

### Example: Dice throwing

Let's define function `throwDice`, that randomly returns integer between 1 and 6:
```js
const throwDice = () => Math.floor(Math.random() * 6) + 1)
```

We want to throw dice until we get 5 or 6. If we get 1 we get discouraged and give up.
Let's define the task.
```js
const throwDiceTask = async () => {
  const number = throwDice()
  if (number == 5 || number == 6) return number  // If success, we return the number we got.
  else if (number == 1) throw 'I got 1 :(.'  // We give up.
  else throw retry.Retry  // By throwing retry.Retry we signalize that we want to retry the task.
}
```

Now we call it with `retry()` and that is it! It will repeat the task forever, until we get 5, 6
or 1.
```js
const number = await retry(throwDiceTask)
```

Right now, task is retried immediatelly after the previous try finished, meaning that we are
repeatedly throwing the dice with no pause. That is making us really tired and we also want to look
more elegant while throwing the dice, so let's take a pause of 1 second after each throw.
```js
const number = await retry(throwDiceTask, { pauseMs: 1000 })
```

Throwing dice like a robot, with always the same pause, soon becomes boring, so we decide to
liven it up a bit by taking random pauses between 1 and 5 seconds with every 50th pause being
10 min so we can take a short nap.
```js
const ourRetryStrategy = (numTries) => {
  if (numTries % 50 == 0) return 10 * 60 * 1000
  return (Math.random() * 4 + 1) * 1000
}

const number = await retry(throwDiceTask, { retryStrategy: ourRetryStrategy })
```

We know that in theory it is possible that we don't get 1, 5 or 6 for very long time (never)
and we have other stuff to do than throw dice whole day, so we need some stop conditions.
Let's say that we are not going to be throwing dice for more than 3 hours or 1000 throws, whichever
happens first, and in that case we want to reject the promise with our custom message.
```js
const number = await retry(throwDiceTask, {
  retryStrategy: ourRetryStrategy,
  maxTries: 1000,
  maxTotalTimeMs: 3 * 60 * 60 * 1000,
  errorOnLimit: 'I am giving up!'
})
```

Finally, we decide we are not bothered by getting 1 and will not give up whichever error happens,
so we will just define `retryOn` to return true for any error that our task is rejected with.
```js
const number = await retry(throwDiceTask, {
  retryStrategy: ourRetryStrategy,
  maxTries: 1000,
  maxTotalTimeMs: 3 * 60 * 60 * 1000,
  errorOnLimit: 'I am giving up!',
  retryOn: e => true  // On any error, retry.
})
```

That is it! We are ready to throw the dice and have some fun while doing it without the risk of it
taking over our whole day.


## API

<a name="exp_module_retry-retry--retry"></a>

## retry(task, [params]) ⇒ <code>Promise</code> ⏏
Tries to execute given task repeatedly until the task succeeds, fails, or until retry limit
(number of tries or total time) is reached.

**Kind**: Exported function  
**Returns**: <code>Promise</code> - Resolved with task's value on task success or rejected with task's error on
    task failure. Rejected with `retry.LimitReached` if one of retry limits was reached.  
**Params**

- task <code>function</code> - Function that returns promise.
    If that promise is resolved, task succeded, retrying stops and result is propagated.
    If that promise is rejected with `retry.Retry` (or some other chosen error,
      see `params.retryOn`), task is retried.
    If that promise is rejected with any other error, task failed, retrying stops and error is
      propagated.
- [params] <code>object</code> - Additional options. Optional.
    - [.pauseMs] <code>integer</code> - Pause between the end of the last try and the start of the next try,
    in milliseconds. This is default behaviour, but it might be modified with `retryStrategy`
    option. Has to be non-negative. Default is 0.
    - [.maxTries] <code>integer</code> - Retry limit. Number of tries after which retrying will stop.
    Has to be non-negative. Default is 0, which means there is no limit on number of tries.
    - [.maxTotalTimeMs] <code>integer</code> - Retry limit. If more than `maxTotalTimeMs` milliseconds
    has elapsed since the first try started, retrying will stop. Has to be non-negative.
    Default is 0, which means there is no time limit.
    - [.retryOn] <code>function</code> - Function that takes error with which promise was
    rejected and returns true if task should be repeated or false if error should be propagated.
    This way you can trigger retry on different errors than just `retry.Retry`.
    By default, it is `(e) => e === retry.Retry`.
    - [.retryStrategy] <code>string</code> | <code>function</code> - Strategy that will be used to
    determine pause between two consecutive tries. Possible values:
      - `'linear'` - This is default strategy. Same pause of `pauseMs` milliseconds is always
          taken between two tries.
      - `'exponential'` - First pause is `pauseMs` milliseconds, second is 2 * `pauseMs`, ...,
          and N-th is 2^N * `pauseMs`.
      - Function that takes number of tries so far and returns pause in milliseconds from the
          end of last try until the start of next try. So after first try `numTries` will be 1.
          This allows you to define your custom strategy.



## Development (for contributors)

### README
We don't directly edit README.md. Instead, we have README.hbs handlebars template that we edit,
and at the end we call `npm run build-readme` to create new version of README.md from README.hbs.
This enables us to automatize some steps of writing README, like e.g. writing API docs.


## FAQ

Q: Where did the name `retry-retry` come from?

A: First of all, `retry` was already taken :D.
   Second, it should be a (f/p)unny name because it repeats / "retries" word "retry" two times.
   Finally, special error that when thrown signalizes that task should be repeated is `retry.Retry`,
   which looks like `retry-retry`. I actually implemented this after I already chose the name,
   but it makes a good story :D.
