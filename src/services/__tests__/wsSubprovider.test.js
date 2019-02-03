const WsSubprovider = require('../wsSubprovider.js')
const WebSocket = global.WebSocket || require('ws')
let sut

const testUrl = 'https://test-'
const rpcUrl = 'wss://' + 'rpc'
const sensuiUrl = testUrl + 'sensui'
const authToken = 'testAuthToken'
const debug = false

const testParams = {rpcUrl, sensuiUrl, authToken, debug}

jest.mock('web3-provider-engine/util/create-payload', () => jest.fn(() => {
  return {jsonRpcReponse: true, id: '123', origin: true}
}))

const createPayload = require('web3-provider-engine/util/create-payload')

beforeEach(() => {
  sut = new WsSubprovider(testParams)
})
describe('WsSubprovider', () => {
  test('constructor', () => {
    expect(sut.connectTime).toBeNull()
    expect(sut.socket).not.toBeNull()
    expect(sut.rpcUrl).toBe(rpcUrl)
    expect(sut.sensuiUrl).toBe(sensuiUrl)
    expect(sut.sensui).not.toBeNull()
    expect(sut.unhandledRequests).toEqual([])
    expect(sut).not.toBeUndefined()
  })

  describe('handleRequest', () => {
    test('Bad socket', () => {
      const payload = {test: true}
      const next = jest.fn()
      const end = jest.fn()

      sut.socket.removeEventListener = jest.fn()
      const res = sut.handleRequest(payload, next, end)
      expect(res).toBeUndefined()
      expect(sut.unhandledRequests[0]).toEqual([payload, next, end])
      expect(end).not.toBeCalled()
      expect(next).not.toBeCalled()
    })

    test('eth_sendRawTransaction', () => {
      const payload = {
        method: 'eth_sendRawTransaction',
        params: [{}],
        id: '123'
      }

      const expectedNewPayload = {
        jsonRpcReponse: true,
        id: payload.id

      }

      const next = jest.fn()
      const end = jest.fn()
      sut.socket = {}
      sut.socket.readyState = WebSocket.OPEN
      sut.pendingRequests.set = jest.fn((payloadId, args) => {})
      sut.sensui.post = jest.fn(() => {})

      const res = sut.handleRequest(payload, next, end)
      expect(res).toBeUndefined()
      expect(sut.sensui.post).toBeCalledTimes(1)
      expect(sut.sensui.post).toBeCalledWith('/relay', expectedNewPayload)
      expect(end).not.toBeCalled()
      expect(next).not.toBeCalled()
      expect(sut.pendingRequests.set).toBeCalledTimes(1)
      expect(sut.pendingRequests.set).toBeCalledWith(payload.id, [payload, end])
    })
    test('other branches', () => {
      const payload = {
        method: 'other',
        params: [{}],
        id: '123'
      }

      const expectedNewPayload = {jsonRpcReponse: true, id: '123'}

      const next = jest.fn()
      const end = jest.fn()
      sut.socket = {}
      sut.socket.send = jest.fn()
      sut.socket.readyState = WebSocket.OPEN
      sut.socket.removeEventListener = jest.fn()
      sut.pendingRequests.set = jest.fn((payloadId, args) => {})

      const res = sut.handleRequest(payload, next, end)
      expect(res).toBeUndefined()
      expect(end).not.toBeCalled()
      expect(next).not.toBeCalled()
      expect(sut.pendingRequests.set).toBeCalledTimes(1)
      expect(sut.pendingRequests.set).toBeCalledWith(payload.id, [payload, end])
      expect(createPayload).toBeCalledWith(payload)
      expect(sut.socket.send).toBeCalledTimes(1)
      expect(sut.socket.send).toBeCalledWith(JSON.stringify(expectedNewPayload))
    })
  })

  test('_handleSocketMessage', () => {
    const reason = 'testing'
    const code = '123'

    sut.socket = {}
    sut.socket.removeEventListener = jest.fn()
    sut.backoff.backoff = jest.fn()
    const removeEventListenerMock = sut.socket.removeEventListener

    sut._handleSocketClose({reason, code})

    expect(removeEventListenerMock).toBeCalledTimes(3)
    expect(sut.socket).toBeNull()
    expect(sut.backoff.backoff).toBeCalled()
    // expect(removeEventListenerMock).toBeCalledWith(
    //   [
    //     ["close",sut._handleSocketClose],
    //     ["message",sut._handleSocketMessage],
    //     ["open",sut._handleSocketOpen]
    //   ])
  })

  describe('_handleSocketMessage', () => {
    test('bad json', () => {
      const badPayload = 'not a json'
      sut.log = jest.fn(() => {})

      const res = sut._handleSocketMessage(badPayload)

      expect(res).toBeUndefined()
      expect(sut.log).toHaveBeenCalledTimes(1)
      expect(sut.log).toHaveBeenLastCalledWith('Received a message that is not valid JSON:', undefined)
    })

    test('Payload undefined', () => {
      const undefId = {id: undefined}
      const badPayload = {
        data: JSON.stringify(undefId)
      }
      const msg = 'not a json'
      sut.emit = jest.fn(() => { return msg })

      const res = sut._handleSocketMessage(badPayload)

      expect(res).toBe(msg)
      expect(sut.emit).toHaveBeenCalledTimes(1)
      expect(sut.emit).toHaveBeenCalledWith('data', null, undefId)
    })

    test('No payload ID', () => {
      const id = '123'
      const goodId = {id: id}
      const payload = {
        data: JSON.stringify(goodId)
      }
      const msg = 'not a json'
      sut.emit = jest.fn(() => { return msg })

      sut.pendingRequests = new Map()
      sut.pendingRequests.has = jest.fn(() => { return false })

      const res = sut._handleSocketMessage(payload)

      expect(res).toBeUndefined()
      expect(sut.pendingRequests.has).toHaveBeenCalledTimes(1)
      expect(sut.pendingRequests.has).toHaveBeenCalledWith(id)
    })

    test('happy', done => {
      const id = '123'
      const payload = {
        id: id,
        method: true,
        result: true
      }
      const payloadMessage = {
        data: JSON.stringify(payload)
      }

      sut.socket.removeEventListener = jest.fn(() => {

      })

      const end = jest.fn((err, res) => {
        if (err) {
          fail()
        }
        expect(res).toBe(payload.result)
      })
      sut.pendingRequests = new Map()
      sut.pendingRequests.set(id, [payload, end])
      sut._handleSocketMessage(payloadMessage)
    })
  })
})
