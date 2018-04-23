# ILP Price
> Fetch price info for currency-agnostic apps on Interledger

- [Overview](#overview)
- [Specify Your Own Landmarks](#specify-your-own-landmarks)
  - [JSON Format](#json-format)
  - [As Environment Variable](#environment-variable)
  - [As File](#file)
- [Examples](#examples)

## Overview

When you're writing an application on Interledger, you shouldn't make any
assumptions about what currency the user has.

Their ledger may be in a commonly known currency like USD, a cryptocurrency
like XRP or BTC, or it may even be a completely alien currency, with no rates
available.

Fetching rates from an outside source introduces a point of failure and may not
even have the right rates.

`ilp-price` solves this problem by keeping a list of "landmarks," which are
receivers _within the Interledger network_ that represent a realisticly liquid
path to a given currency. By sending a probing payment to these landmarks, you
can discover a conversion rate to their currencies.

This module will include some defaults, but these can be overridden with
environment variables or a config file.

## Specify Your Own Landmarks

### JSON Format

Landmarks for `ilp-price` are specified in the following format:

```js
{
  "XRP": [
    "$xrp-landmark.example.com",
    "$other.example.com",
    "https://raw-spsp-endpoint.example.com",
    // ...
  ],
  "USD": [
    "$usd-landmark.example.com",
    // ...
  ],
  // ...
}
```

The outer object is a map from currency codes to lists of [SPSP
receivers](https://github.com/interledger/rfcs/blob/master/0009-simple-payment-setup-protocol/0009-simple-payment-setup-protocol.md).
These receivers can be listed as raw HTTP(s) endpoints, or as [Payment
Pointers](https://github.com/interledger/rfcs/blob/master/0026-payment-pointers/0026-payment-pointers.md)

### As Environment Variable

You can pass in an alternative list of landmarks via the environment variable
`ILP_PRICE_LANDMARKS`. This variable should be a string containing JSON, [in the
format specified above](#json-format).

If provided, this list will replace the default one inside the module.

Example:

```
export ILP_PRICE_LANDMARKS='{"XRP":["$xrp-landmark.example.com","$other.example.com","https://raw-spsp-endpoint.example.com"],"USD":["$usd-landmark.example.com"]}'
```

### As File

You can also specify an alternate list by pointing to a JSON file. You can
specify this file via the environment variable `ILP_PRICE_LANDMARKS_FILE`.  It
should contain a string with the file's path. If this path is relative, then it
is read relative to the current working directory.

If this is specified alongside `ILP_PRICE_LANDMARKS`, then
`ILP_PRICE_LANDMARKS` will take precedent and the file will not be read.

Example:

```
export ILP_PRICE_LANDMARKS_FILE='/home/bob/my_price_infomation_file.json'
```

## Examples

```js
const Price = require('ilp-price')

// Landmarks can be passed in explicitly; this overrides the defaults and all
// environment variables. This is generally not a good idea, though, unless
// you're populating the list from a source that can be updated over time.
const customPrice1 = new Price({
  landmarks: {
    "XRP": [
      "$xrp-landmark.example.com",
      "$other.example.com",
      "https://raw-spsp-endpoint.example.com"
    ],
    "USD": [
      "$usd-landmark.example.com"
    ]
  }
})

// You can pass a plugin into the Price constructor. However, `ilp-plugin` is
// used by default so this example below is redundant.
const plugin = require('ilp-plugin')()
const customPrice2 = new Price({
  plugin
})

// The ordinary way to instantiate a Price helper.
const price = new Price()

;(async function run () {

  // Loads rate from:
  //   - ILDCP (in case we already have USD)
  //   - Landmarks under 'USD', in order. If one fails it falls back to the
  //   next.

  const twoCents = await price.get('USD', 0.02)
  const oneXrp = await price.get('XRP', 1)

})()
```
