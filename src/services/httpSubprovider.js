const xhr = require('request') || window.xhr
const createPayload = require('web3-provider-engine/util/create-payload.js')
const Subprovider = require('./subprovider.js')
const JsonRpcError = require('json-rpc-error')

class RpcSource extends Subprovider {
  constructor ({ rpcUrl, sensuiUrl, authToken }) {
    super()
    this.rpcUrl = rpcUrl
    this.sensuiUrl = sensuiUrl
    this.authToken = authToken
  }

  handleRequest (payload, next, end) {
    let newPayload = createPayload(payload)

    if (payload.method === 'eth_sendRawTransaction') {
      newPayload = payload.params[0]
      newPayload.jsonRpcReponse = true
      newPayload.id = payload.id
    }

    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
    console.log('---------------------> Using the HTTP Provider')
    xhr({
      // uri: payload.method === ('eth_sendRawTransaction') ? (this.sensuiUrl + '/relay') : (this.rpcUrl),
      uri: payload.method === ('eth_sendRawTransaction') ? ('http://localhost:3000' + '/trigger') : (this.rpcUrl),
      // uri: payload.method === ('eth_sendRawTransaction') ? ('http://localhost:3035' + '/relay') : (this.rpcUrl),
      method: 'POST',
      headers: payload.method === ('eth_sendRawTransaction') ? (Object.assign(headers, { Authorization: 'Bearer ' + this.authToken })) : (headers),
      body: JSON.stringify(newPayload),
      rejectUnauthorized: false
    }, (error, res, body) => {
      // ----> here!
      // console.log('\n body' + JSON.stringify(body))
      // console.log('\n res' + JSON.stringify(res))
      // console.log('\n error' + JSON.stringify(error))

      if (error) {
        console.error('------> error in 44')
        return end(new JsonRpcError.InternalError(error))
      }
      switch (res.statusCode) {
        case 405:
          console.error('------> error in 49')
          return end(new JsonRpcError.MethodNotFound())
        case 504: // Gateway timeout
          console.error('------> error in 52')
          let msg = `Gateway timeout. The request took too long to process. `
          msg += `This can happen when querying logs over too wide a block range.`
          const error = new Error(msg)
          return end(new JsonRpcError.InternalError(error))
        default:
          if (res.statusCode !== 200) {
            return end(new JsonRpcError.InternalError(res.body))
          }
      }

      let data
      try {
        data = JSON.parse(body) || body
      } catch (error) {
        console.error('------> error in 67')
        console.error('-----------------------------\n------------------------')
        console.error(body)
        console.error(error.stack)
        return end(new JsonRpcError.InternalError(error))
      }
      if (data.error) {
        console.error('------> error in 71')
        console.error(error.stack)
        return end(data.error)
      }

      end(null, data.result)
    })
  }
}

module.exports = RpcSource
