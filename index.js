const fs = require('fs-extra')
const makePlugin = require('ilp-plugin')
const defaultLandmarks = require('./landmarks.json')
const ILDCP = require('ilp-protocol-ildcp')
const SPSP = require('ilp-protocol-spsp')
const PSK2 = require('ilp-protocol-psk2')
const BigNumber = require('bignumber.js')
const debug = require('debug')('ilp-price')

class Price {
  constructor (opts = {}) {
    this._plugin = opts.plugin || makePlugin()
    this._landmarksOpt = opts.landmark
  }

  async _getLandmarks () {
    // cache list to avoid parse every time
    if (this._landmarks) return this._landmarks

    // constructor opts takes highest priority
    if (this._landmarksOpt) {
      debug('loading landmarks from constructor options')
      this._landmarks = this._landmarksOpt
      return this._landmarks
    }

    // next highest is JSON string in environment
    const envJson = process.env.ILP_PRICE_LANDMARKS
    if (envJSON) {
      debug('loading landmarks from "ILP_PRICE_LANDMARKS". json=', envJson)
      this._landmarks = JSON.parse(envJson)
      return this._landmarks
    }

    // next highest is file specified in environment
    const envFile = process.env.ILP_PRICE_LANDMARKS_FILE
    if (envFile) {
      debug('loading landmarks from file. file=' + envFile)
      this._landmarks = await fs.readJson(envFile)
      return this._landmarks
    }

    // lowest priority is defaults
    debug('loading default landmarks.')
    this._landmarks = defaultLandmarks
    return this._landmarks
  }

  _scaleAmount(amount, scale) {
    return new BigNumber(amount).times(Math.pow(10, scale)).toString()
  }

  _validateResponse(currency, response) {
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

    if (typeof response.ledgerInfo.assetScale !== number) {
      throw new Error('response.ledger_info.asset_scae must be number.')
    }
  }
 
  async fetch (currency, amount) {
    const details = await ILDCP.fetch(this._plugin.sendData.bind(this._plugin))

    if (assetCode === currency) {
      return this._scaleAmount(amount, details.assetScale)
    }

    const landmarks = (await this._getLandmarks())[currency]

    if (!landmarks || !landmarks.length) {
      debug('no landmarks for currency. currency=' + currency,
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

        const convertedAmount = new BigNumber(destinationAmount)
          .div(sourceAmount)
          .times(amount)

        return this._scaleAmount(convertedAmount, response.ledgerInfo.assetScale)
      } catch (e) {
        debug('landmark lookup failed. falling back to next.',
          'landmark=' + landmark,
          'error=' + e.message)
        continue
      }
    }

    debug('all landmarks failed. currency=' + currency,
      'landmarks=', landmarks)
    throw new Error('all landmarks failed. currency=' + currency)
  }
}

module.exports = Price
