# ILP Price
> Fetch price info for currency-agnostic apps on Interledger

- [Overview](#overview)
- [Specify Your Own Landmarks](#specify-your-own-landmarks)
  - [JSON Format](#json-format)
    - [Prefix Map](#prefix-map)
    - [Currency Map](#currency-map)
    - [Landmark List](#landmark-list)
  - [As Environment Variable](#environment-variable)
  - [As File](#file)
- [Examples](#examples)
- [TODOs](#todos)

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
  "g.": {
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
  },
  "test.": {
    "XRP": [
      "$spsp.ilp-test.com"
    ]
  },
  // ...
}
```

The landmark specification is made up of three levels.

- Prefix map
- Currency map
- Landmark list

#### Prefix Map

The outermost object contains ILP address prefixes. When you ask for a price,
an [ILDCP](https://github.com/interledgerjs/ilp-protocol-ildcp) lookup is made,
and the address is compared against the keys of this map.

The longest key which is a prefix of the address is selected. The value under
that key is then used as the currency map.

If no keys are prefixes of your ILP address, an error should be thrown.

#### Currency Map

The currency map maps currency codes to landmark lists. A simple lookup is done
with the desired currency of your price lookup. The value associated with that
currency code is used as the landmark list.

If the desired currency code is not present, an error should be thrown.

#### Landmark List

The landmark lists are lists of [SPSP
receivers](https://github.com/interledger/rfcs/blob/master/0009-simple-payment-setup-protocol/0009-simple-payment-setup-protocol.md).
These receivers can be listed as raw HTTP(s) endpoints, or as [Payment
Pointers](https://github.com/interledger/rfcs/blob/master/0026-payment-pointers/0026-payment-pointers.md)

The landmark list is used to fetch an actual exchange rate by using the
Interledger network and a transport protocol. If the rate cannot be retrieved
through one landmark, then another one is tried.

If all landmarks return errors, an error is thrown.

### Merging Landmarks

Because landmarks are loaded from many sources, there needs to be a way to
merge this information.  The [prefix maps](#prefix-map) and [currency
maps](#currency-map) are merged, but the [landmark lists](#landmark-list) are
not.

For example, let's say we have two landmark specifications.

Landmark spec A:

```js
{
  "g.": {
    "XRP": [
      "$a.example",
      "$b.example"
    ],
    "USD": [
      "$c.example",
      "$d.example",
      "$e.example"
    ]
  },
  "test.": {
    "XRP": [
      "$f.example"
    ]
  }
}
```

Landmark spec B:

```
{
  "g.": {
    "XRP": [
      "$g.example"
    ]
  },
  "private.": {
    "XRP": [
      "$localhost"
    ]
  }
}
```

If we merge landmark spec B into landmark spec A, we get the following result:

```js
{
  "g.": {
    "XRP": [
      "$g.example"
    ],
    "USD": [
      "$c.example",
      "$d.example",
      "$e.example"
    ]
  },
  "test.": {
    "XRP": [
      "$f.example"
    ]
  },
  "private.": {
    "XRP": [
      "$localhost"
    ]
  }
}
```

### As Environment Variable

You can pass in an alternative landmark specification via the environment variable
`ILP_PRICE_LANDMARKS`. This variable should be a string containing JSON, [in the
format specified above](#json-format).

Example:

```
export ILP_PRICE_LANDMARKS='{"g.":{"XRP":["$xrp-landmark.example.com","$other.example.com","https://raw-spsp-endpoint.example.com"],"USD":["$usd-landmark.example.com"]}}'
```

If provided, this list will be [merged](#merging-landmarks) into the default
landmarks.

### As File

You can also specify an alternate list by pointing to a JSON file. You can
specify this file via the environment variable `ILP_PRICE_LANDMARKS_FILE`.  It
should contain a string with the file's path. If this path is relative, then it
is read relative to the current working directory.

Example:

```
export ILP_PRICE_LANDMARKS_FILE='/home/bob/my_price_infomation_file.json'
```

This file will be [merged](#merging-landmarks) into the default landmarks. If `ILP_PRICE_LANDMARKS` is specified,
it will be merged into the result of that operation.

The order of application goes:

```
default -> ILP_PRICE_LANDMARKS_FILE -> ILP_PRICE_LANDMARKS -> constructor
```

## Examples

```js
const Price = require('ilp-price')

// Landmarks can be passed in explicitly; this is applied after the defaults
// and after all environment variables. This is generally not a good idea,
// though, unless you're populating the list from a source that can be updated
// over time.
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

  const twoCents = await price.fetch('USD', 0.02)
  const oneXrp = await price.fetch('XRP', 1)

  // You can bind price.fetch to create a convenience function, if you plan to
  // do everything in one currency.

  const toUsd = price.fetch.bind(price, 'USD')

})()
```

## TODOs

- [x] Handle livenet vs. testnet vs. others
- [ ] Use up-to-date transport protocol
- [ ] More landmarks for more currencies
