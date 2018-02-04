retry-retry
&middot;
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/Martinsos/retry-retry/blob/master/LICENSE)
[![npm version](https://img.shields.io/npm/v/retry-retry.svg?style=flat)](https://www.npmjs.com/package/retry-retry)
[![Travis CI (master branch)](https://img.shields.io/travis/Martinsos/retry-retry/master.svg?label=travis%20ci)](https://travis-ci.org/Martinsos/retry-retry)
[![Coverage Status](https://img.shields.io/coveralls/Martinsos/retry-retry/master.svg?style=flat)](https://coveralls.io/github/Martinsos/retry-retry?branch=master)
=====

Javascript library for easy retrying of tasks.

Retrying your function (that takes `retry` parameter and returns promise) is as simple as:
```
const result = await retry(myFunction)
```

## Features

## Using in your project

## Usage and examples

```
// Throw dice until we get 5 or 6. If we get 1, we give up.
const dice = await retry(retry => async {
  const dice = Math.floor(Math.random() * 6) + 1)
  if (dice == 5 || dice == 6) return dice
  if (dice == 1) throw 'I got 1 :(.'
  retry()
})
```

## API
