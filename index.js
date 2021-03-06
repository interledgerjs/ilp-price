const fs = require('fs-extra')
const makePlugin = require('ilp-plugin')
const defaultLandmarks = require('./landmarks.json')
const ILDCP = require('ilp-protocol-ildcp')
const SPSP = require('ilp-protocol-spsp')
const PSK2 = require('ilp-protocol-psk2')
const BigNumber = require('bignumber.js')
const log = require('ilp-logger')('ilp-price')

class Price {
  constructor (opts = {}) {
    this._plugin = opts.plugin || makePlugin()
    this._landmarksOpt = opts.landmarks
  }

  mergeLandmarks (map, update) {
    for (const key of Object.keys(update)) {
      if (map[key]) {
        Object.assign(map[key], update[key])
      } else {
        map[key] = update[key]
      }
    }
  }

  async _getLandmarks () {
    // cache list to avoid parse every time
    if (this._landmarks) return this._landmarks

    // start with the defaults
    this._landmarks = defaultLandmarks

    // if file is specified, apply it
    const envFile = process.env.ILP_PRICE_LANDMARKS_FILE
    if (envFile) {
      log.info('loading landmarks from file. file=' + envFile)
      try {
        this.mergeLandmarks(this._landmarks, await fs.readJson(envFile))
      } catch (e) {
        log.error('error loading landmarks from file. error=' + e.message)
      }
    }

    // if env is specified, apply it after file
    const envJson = process.env.ILP_PRICE_LANDMARKS
    if (envJson) {
      log.info('loading landmarks from "ILP_PRICE_LANDMARKS". json=', envJson)
      try {
        this.mergeLandmarks(this._landmarks, JSON.parse(envJson))
      } catch (e) {
        log.error('error loading landmarks from env. error=' + e.message)
      }
    }

    // finally apply constructor opts if available
    if (this._landmarksOpt) {
      log.info('loading landmarks from constructor options')
      this.mergeLandmarks(this._landmarks, this._landmarksOpt)
    }

    // return final result of application
    return this._landmarks
  }

  _scaleAmount (amount, scale) {
    return new BigNumber(amount).times(Math.pow(10, scale)).toFixed(0)
  }

  _validateResponse (currency, response) {
    if (!response.ledgerInfo) {
      throw new Error('response.ledger_info must be defined')
    }

    if (typeof response.ledgerInfo !== 'object') {
      throw new Error('response.ledger_info must be an object')
    }

    if (response.ledgerInfo.assetCode !== currency) {
      throw new Error('response.ledger_info.asset_code must match currency. ' +
        'asset_code=' + response.ledgerInfo.assetCode + ' ' +
        'currency=' + currency)
    }

    if (typeof response.ledgerInfo.assetScale !== 'number') {
      throw new Error('response.ledger_info.asset_scae must be number.')
    }
  }

  async fetch (currency, amount) {
    await this._plugin.connect()
    const details = await ILDCP.fetch(this._plugin.sendData.bind(this._plugin))

    if (details.assetCode === currency) {
      return this._scaleAmount(amount, details.assetScale)
    }

    const longestMatchingPrefix = Object.keys(await this._getLandmarks())
      .reduce((agg, e) => {
        return (details.clientAddress.startsWith(e) && e.length > (agg || '').length) ? e : agg
      }, null)

    if (longestMatchingPrefix === null) {
      throw new Error('no landmarks for client address prefix.' +
        ' clientAddress=' + details.clientAddress +
        ' landmarks=' + JSON.stringify(this._landmarks))
    }

    const landmarks = (await this._getLandmarks())[longestMatchingPrefix][currency]

    if (!landmarks || !landmarks.length) {
      log.error('no landmarks for currency. currency=' + currency,
        'landmarks=', this._landmarks)
      throw new Error('no landmarks for currency. currency=' + currency)
    }

    for (const landmark of landmarks) {
      try {
        const response = await SPSP.query(landmark)
        this._validateResponse(currency, response)

        // TODO: update to STREAM once available
        const sourceAmount = '1000'
        const { destinationAmount } = await PSK2.quoteSourceAmount(this._plugin, {
          ...response,
          sourceAmount
        })

        const convertedAmount = new BigNumber(sourceAmount)
          .div(destinationAmount)
          .times(amount)

        return this._scaleAmount(convertedAmount, response.ledgerInfo.assetScale)
      } catch (e) {
        log.error('landmark lookup failed. falling back to next.',
          'landmark=' + landmark,
          'error=' + e.message)
        continue
      }
    }

    log.error('all landmarks failed. currency=' + currency,
      'landmarks=', landmarks)
    throw new Error('all landmarks failed. currency=' + currency)
  }
}

module.exports = Price
