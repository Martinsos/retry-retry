retry-retry
&middot;
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/Martinsos/retry-retry/blob/master/LICENSE)
[![npm version](https://img.shields.io/npm/v/retry-retry.svg?style=flat)](https://www.npmjs.com/package/retry-retry)
[![Travis CI (master branch)](https://img.shields.io/travis/Martinsos/retry-retry/master.svg?label=travis%20ci)](https://travis-ci.org/Martinsos/retry-retry)
[![Coverage Status](https://img.shields.io/coveralls/Martinsos/retry-retry/master.svg?style=flat)](https://coveralls.io/github/Martinsos/retry-retry?branch=master)
=====

Javascript library for easy retrying of tasks (task is just a function).

Simple example (polling for a resource) using async/await:
```js
const retry = require('retry-retry')

const resource = await retry(async (_retry) => {
  try {
    return await yourResourceFetchingPromiseReturningFunction()  
  } catch (e) {
    if (e.code == 'ResourceNotReady') _retry() else throw 'Unexpected error, stopping.'
  }
}, { pauseMs: 1000, maxTotalTimeMs: 3 * 60 * 1000, retryStrategy: 'exponential' })
```

## Features
- Promise based.
- Supports setting limit on total elapsed time and / or max number of tries.
- Supports linear, exponential or custom retry strategy (duration of pauses between tries).
- No dependencies.
- Simple interface.
- Has fun name.


## Using in your project
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

You can also directly include `retry-retry.js` into your code using `script` tag.
retry-retry sets `window['retry-retry']` to `retry` function (if there is a window object),
so you can access it like this:
```js
const retry = window['retry-retry']
```

## Usage and examples

retry-retry has only one public function: `retry`.

In order to run your function many times, you just pass it to `retry` and then have it signal
that it succeeded / wants to try again / is giving up.
You can also pass additional options to `retry` for finer control of how retrying is done.

That is it! Check examples below and API for more details.

### Example: Dice throwing

Let's define function `throwDice`, that randomly returns integer between 1 and 6:
```js
const throwDice = () => Math.floor(Math.random() * 6) + 1)
```

We want to throw dice until we get 5 or 6. If we get 1 we get discouraged and give up.
Let's define the task.
```js
const throwDiceTask = async (_retry) => {
  const number = throwDice()
  if (number == 5 || number == 6) return number  // If success, we return the number we got.
  else if (number == 1) throw 'I got 1 :(.'  // We give up.
  else _retry()  // By calling _retry() we signalize that we want to try again after this try.
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

That is it! We are ready to throw the dice and have some fun while doing it without the risk of it
taking over our whole day.


## API

TODO


## FAQ

Q: Where did the name `retry-retry` come from?

A: First of all, `retry` was already taken :D.
   Second, it should be a (f/p)unny name because it repeats / "retries" word "retry" two times.
   Finally, if you pass `retry()` an arrow function like this `retry(_retry => ...)` it looks
   like `retry-retry`. I actually didn't notice this until after I already chose the name,
   but it makes a good story :D.
