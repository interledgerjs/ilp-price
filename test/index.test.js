'use strict' /* eslint-env mocha */

const IlpPrice = require('..')
const PSK2 = require('ilp-protocol-psk2')
const SPSP = require('ilp-protocol-spsp')
const ILDCP = require('ilp-protocol-ildcp')
const Plugin = require('ilp-plugin-btp')

const assert = require('chai').assert
const sinon = require('sinon')

describe('ILP Price', function () {
  beforeEach(function () {
    this.sinon = sinon.sandbox.create()
    this.plugin = new Plugin({ server: 'example.com' })

    this.sinon.stub(this.plugin, 'connect').resolves()
    this.queryStub = this.sinon.stub(SPSP, 'query').resolves({
      ledgerInfo: {
        assetCode: 'USD',
        assetScale: 9
      }
    })

    this.ildcpStub = this.sinon.stub(ILDCP, 'fetch').resolves({
      clientAddress: 'test.alice',
      assetCode: 'XRP',
      assetScale: 9
    })

    this.quoteStub = this.sinon.stub(PSK2, 'quoteSourceAmount').resolves({
      destinationAmount: '800'
    })

    this.price = new IlpPrice({
      plugin: this.plugin,
      landmarks: {
        'test.': {
          USD: [ '$localhost' ]
        }
      }
    })
  })

  afterEach(function () {
    this.sinon.restore()
  })

  describe('fetch', function () {
    it('should convert a rate correctly', async function () {
      const result = await this.price.fetch('USD', 1)

      assert.equal(result, String(1.25e9))
      assert.deepEqual(this.queryStub.firstCall.args, [ '$localhost' ])
    })
  })

  describe('mergeLandmarks', function () {
    beforeEach(function () {
      this.landmarks = {
        'g.': {
          'XRP': [
            '$a.example',
            '$b.example'
          ],
          'USD': [
            '$c.example',
            '$d.example',
            '$e.example'
          ]
        },
        'test.': {
          'XRP': [
            '$f.example'
          ]
        }
      }
    })

    it('should merge prefix and currency maps but not lists', function () {
      this.price.mergeLandmarks(this.landmarks, {
        'g.': {
          'XRP': [
            '$g.example'
          ]
        },
        'private.': {
          'XRP': [
            '$localhost'
          ]
        }
      })

      assert.deepEqual(this.landmarks, {
        'g.': {
          'XRP': [
            '$g.example'
          ],
          'USD': [
            '$c.example',
            '$d.example',
            '$e.example'
          ]
        },
        'test.': {
          'XRP': [
            '$f.example'
          ]
        },
        'private.': {
          'XRP': [
            '$localhost'
          ]
        }
      })
    })
  })
})
