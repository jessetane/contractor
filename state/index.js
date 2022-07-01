import url from 'url-state'
import { ethers } from 'ethers'
import watchTx from 'eth-scripts/watch-tx.js'
import WalletConnect from 'wallet-connect'

const lsPrefix = 'contractor'
const proxySlot = ethers.BigNumber.from(ethers.utils.id('eip1967.proxy.implementation')).sub(1).toHexString()

const state = new EventTarget()
state.ethers = ethers
state.url = url
state.change = () => state.dispatchEvent(new Event('change'))
url.addEventListener('change', state.change)

window.state = state
export default state

Object.defineProperty(state, 'network', {
  get: () => {
    const network = state.networksById[state.chainId]
    if (network) {
      if (!network.provider) {
        if (network.rpcUrls) {
          network.provider = new ethers.providers.JsonRpcProvider(network.rpcUrls[0])
        } else {
          network.provider = new ethers.providers.InfuraProvider(network.name)
        }
      }
      if (!network.cache) {
        network.cache = {}
      }
    }
    return network
  },
  set: (name) => {
    const network = state.networksByName[name] || state.networksById[name]
    if (!network) throw new Error('unknown network ' + name)
    if (state.chainId === network.chainId) return
    state.chainId = localStorage[lsPrefix + '.chainId'] = network.chainId
    state.change()
  }
})

Object.defineProperty(state, 'recentAbis', {
  get: function () {
    const network = this.network
    const recents = []
    if (network) {
      const prefix = lsPrefix + '.contracts.' + network.chainId + '.'
      Object.keys(localStorage).forEach(key => {
      if (key.indexOf(prefix) !== 0) return
        const val = JSON.parse(localStorage[key])
        if (!val.searched) return
        val.key = key.slice(prefix.length)
        recents.push(val)
      })
    }
    return recents
  },
  set: function (x) {
    if (x !== null) throw new Error('not implemented')
    const network = this.network
    if (!network) throw new Error('no network selected')
    const prefix = lsPrefix + '.contracts.' + network.chainId + '.'
    Object.keys(localStorage).forEach(key => {
      if (key.indexOf(prefix) === 0) {
        delete localStorage[key]
      }
    })
    network.cache = {}
    state.change()
  }
})

Object.defineProperty(state, 'account', {
  get: function () {
    if (state.wallet) {
      return state.wallet.peerAccounts[0]
    } else if (state.extension) {
      return state.extension.account
    }
  }
})

state.saveNetwork = async function (chainId, params) {
  let network = state.networksById[chainId]
  if (params === null) {
    if (network) {
      state.networks = state.networks.filter(n => n.chainId !== chainId)
      delete state.networksById[chainId]
      delete state.networksByName[network.chainName]
    }
    delete localStorage[lsPrefix + '.networks.' + chainId]
    if (state.chainId === chainId) {
      if (state.networks.length) {
        state.network = state.networks[0].chainId
      } else {
        window.location = window.location
      }
    }
  } else {
    if (!params.chainName) throw new Error('Missing chainName')
    if (!Array.isArray(params.rpcUrls) || params.rpcUrls.length === 0) throw new Error('Missing rpcUrls')
    if (!params.abiUrl) throw new Error('Missing abiUrl')
    if (network) {
      delete state.networksByName[network.chainName]
      if (network.rpcUrls[0] !== params.rpcUrls[0]) {
        delete network.provider
      }
      Object.assign(network, params)
      state.networksByName[network.chainName] = network
    } else {
      network = params
      network.chainId = chainId
      state.networks.push(network)
      state.networksById[chainId] = network
      state.networksByName[network.chainName] = network
    }
    localStorage[lsPrefix + '.networks.' + chainId] = JSON.stringify({
      chainId: network.chainId,
      chainName: network.chainName,
      rpcUrls: network.rpcUrls,
      abiUrl: network.abiUrl
    })
  }
}

state.addNetworkToWallet = async function (chainId) {
  if (!state.wallet) throw new Error('No wallet connected')
  const network = state.networksById[chainId]
  if (!network) throw new Error('Unknown network ' + chainId)
  let chainIdHex = parseInt(chainId).toString(16)
  // while (chainIdHex.length % 2) chainIdHex = `0${chainIdHex}`
  chainIdHex = `0x${chainIdHex}`
  const params = {
    chainId: chainIdHex,
    chainName: network.chainName,
    rpcUrls: network.rpcUrls,
  }
  return state.wallet.call('wallet_addEthereumChain', params)
}

state.normalizeAddress = async function (input) {
  if (typeof input === 'object') return input
  const r = {
    input,
    normalized: input,
    resolved: null
  }
  if (input.indexOf('0x') === 0 && input.length === 42) {
    r.normalized = ethers.utils.getAddress(input)
    r.resolved = r.normalized
  } else {
    r.normalized = input.toLowerCase()
    r.resolved = await state.network.provider.resolveName(input)
  }
  return r
}

state.loadMeta = async function (contract, searched) {
  const { normalized, resolved } = contract 
  const network = state.network
  const prefix = lsPrefix + '.contracts.' + network.chainId
  let meta = network.cache[normalized]
  if (contract.abi) {
    return state.saveMeta(normalized, {
      abi: JSON.parse(contract.abi),
      name: meta.name,
      searched
    })
  }
  if (meta) {
    if (meta.then) {
      console.log('loading from network')
      return meta
    } else {
      console.log('loaded from memory')
    }
  } else if (meta = localStorage[prefix + '.' + normalized]) {
    try {
      meta = JSON.parse(meta)
      network.cache[normalized] = meta
      console.log('loaded from disk')
    } catch (err) {
      delete network.cache[normalized]
      delete localStorage[prefix + '.' + normalized]
    }
  }
  if (meta) {
    if (searched && !meta.searched) {
      meta.searched = true
      await state.saveMeta(normalized, meta)
    }
    return meta
  }
  let url = network.abiUrl
  const last = url[url.length - 1]
  if (last !== '=' && last !== '/') url += '/'
  url += resolved
  console.log('fetching', url)
  return network.cache[normalized] = fetch(url).then(async res => {
    try {
      const body = await res.text()
      let abi = JSON.parse(body)
      if (abi.result) {
        if (abi.status + '' !== '1') {
          throw new Error(abi.result)
        }
        abi = JSON.parse(abi.result)
      }
      meta = network.cache[normalized] = await state.saveMeta(normalized, { abi, searched })
    } catch (err) {
      delete network.cache[normalized]
      delete localStorage[prefix + '.' + normalized]
      const error = new Error('Failed to fetch ABI for ' + normalized)
      error.reason = err
      throw error
    }
    return meta
  })
}

state.saveMeta = async function (normalized, meta) {
  const network = state.network
  const prefix = lsPrefix + '.contracts.' + network.chainId
  meta = network.cache[normalized] = {
    name: meta.name,
    searched: meta.searched,
    abi: meta.abi
  }
  localStorage[prefix + '.' + normalized] = JSON.stringify(meta)
  return meta
}

state.loadContract = async function (addressInput, proxyAddressInput, contract) {
  const network = state.network
  let abi = null
  let searched = false
  if (contract) {
    if (contract.input === undefined) {
      abi = contract.abi
      searched = true
      contract = null
    } else if (addressInput === contract.input) {
      if (proxyAddressInput === undefined) {
        delete contract.proxy
        return contract
      } else if (contract.proxy) {
        if (proxyAddressInput === '' || proxyAddressInput === contract.proxy.input) {
          return contract
        } else {
          delete contract.proxy
        }
      }
    } else {
      contract = null
    }
  }
  if (!contract) {
    contract = await state.normalizeAddress(addressInput)
    contract.abi = abi
    Object.assign(contract, await state.loadMeta(contract, searched))
    contract.iface = new ethers.Contract(contract.resolved, contract.abi, state.network.provider)
  }
  if (proxyAddressInput !== undefined && !contract.proxy) {
    if (proxyAddressInput) {
      contract.proxy = await state.normalizeAddress(proxyAddressInput)
    } else {
      console.log('reading proxy storage slot')
      let proxyAddress = await network.provider.getStorageAt(contract.resolved, proxySlot)
      proxyAddress = state.ethers.BigNumber.from(proxyAddress).toHexString()
      contract.proxy = await state.normalizeAddress(proxyAddress)
    }
    Object.assign(contract.proxy, await state.loadMeta(contract.proxy))
    contract.proxy.iface = new ethers.Contract(contract.resolved, contract.proxy.abi, state.network.provider)
  }
  return contract
}

state.search = async function (address, page = 0, size = 1000) {
  const network = state.network
  const currentBlock = await network.provider.getBlockNumber()
  const start = currentBlock - size * page
  const end = start + size
  return await network.provider.getHistory(address, end, start)
}

state.disconnect = function () {
  if (state.extension) {
    ethereum.removeListener('accountsChanged', state.extension.onaccountsChanged)
    ethereum.removeListener('chainChanged', state.extension.onchainChanged)
    delete localStorage[lsPrefix + '.metaMaskSession']
    delete state.extension
    state.change()
  }
  if (state.wallet) {
    state.wallet.destroySession()
  }
}

state.connect = async function (session) {
  if (state.wallet) {
    throw new Error('session already in progress')
  }
  const meta = {
    name: 'Contractor',
    description: 'Generic smart contract interfaces',
    url: window.location.origin,
    icons: []
  }
  if (session) {
    session = JSON.parse(session)
    const key = new Uint8Array(32)
    for (var k in session.key) {
      key[k] = session.key[k]
    }
    session.key = key
    console.log('wallet existing session found', session)
  }
  const wallet = state.wallet = new WalletConnect(session ? Object.assign({ meta }, session) : { meta })
  wallet.addEventListener('sessionUpdate', () => {
    const session = wallet.session
    console.log('wallet session update', session)
    if (session.chainId && session.peerAccounts.length) {
      localStorage[lsPrefix + '.walletConnectSession'] = JSON.stringify(session)
      if (state.chainId !== wallet.chainId.toString()) {
        try {
          state.network = wallet.chainId
          return
        } catch (err) {
          alert('Wallet switched to an unknown network: ' + wallet.chainId)
        }
      }
    }
    state.change()
  })
  wallet.addEventListener('sessionDestroy', () => {
    console.log('wallet session destroy')
    delete localStorage[lsPrefix + '.walletConnectSession']
    delete state.wallet
    state.change()
  })
  if (session) {
    await wallet.resumeSession()
  } else {
    const evt = new Event('sessionCreate')
    const uri = evt.uri = wallet.uri
    state.dispatchEvent(evt) // used by nav to display qrcode
    await wallet.createSession()
  }
}

state.connectExtension = async function () {
  if (!window.ethereum || !ethereum.isConnected()) {
    throw new Error('Extension not found')
  }
  function onaccountsChanged (accounts) {
    console.log('extension accountsChanged', accounts)
    if (accounts.length) {
      state.extension.account = accounts[0]
      state.change()
    } else {
      state.disconnect()
    }
  }
  function onchainChanged (chainId) {
    chainId = parseInt(chainId)
    console.log('extension chainChanged', chainId)
    state.extension.chainId = chainId
    try {
      state.network = chainId
    } catch (err) {
      alert('Extension switched to an unknown network: ' + chainId)
    }
    state.change()
  }
  state.extension = {
    onaccountsChanged,
    onchainChanged
  }
  let accounts = await ethereum.request({ method: 'eth_accounts' })
  if (!accounts.length) {
    accounts = await ethereum.request({ method: 'eth_requestAccounts' })
    if (!accounts.length) {
      throw new Error('Extension did not provide any accounts')
    }
  }
  state.extension.account = accounts[0]
  const chainId = state.extension.chainId = parseInt(await ethereum.request({ method: 'eth_chainId' }))
  try {
    state.network = chainId
  } catch (err) {
    alert('Extension switched to an unknown network: ' + chainId)
    state.change()
  }
  ethereum.on('accountsChanged', onaccountsChanged)
  ethereum.on('chainChanged', onchainChanged)
  localStorage[lsPrefix + '.metaMaskSession'] = 'yes'
}

state.call = async function () {
  if (state.wallet) {
    return state.wallet.call(...arguments)
  } else if (state.extension) {
    return ethereum.request({ method: arguments[0], params: Array.from(arguments).slice(1) })
  } else {
    throw new Error('No wallet connected')
  }
}

async function main () {
  // load known networks
  const networks = []
  const networksPrefix = lsPrefix + '.networks.'
  Object.keys(localStorage).forEach(key => {
    if (key.indexOf(networksPrefix) === 0) {
      try {
        networks.push(JSON.parse(localStorage[key]))
      } catch (err) {
        console.error('Failed to load network: ' + key.slice(networksPrefix.length), err)
      }
    }
  })
  // if no networks were known, synthesize mainnet
  if (networks.length === 0) {
    const network = {
      chainId: '1',
      chainName: 'mainnet',
      rpcUrls: ['https://mainnet.infura.io/v3/84842078b09946638c03157f83405213'],
      blockExplorerUrls: ['https://etherscan.io'],
      abiUrl: 'https://api.etherscan.io/api?module=contract&action=getabi&address='
    }
    networks.push(network)
    localStorage[networksPrefix + '1'] = JSON.stringify(network)
  }
  // build network lookup tables
  const networksById = {}
  const networksByName = {}
  networks.forEach(n => {
    networksById[n.chainId] = n
    networksByName[n.chainName] = n
  })
  state.networks = networks
  state.networksById = networksById
  state.networksByName = networksByName
  // set current network
  state.chainId = localStorage[lsPrefix + '.chainId']
  if (!networksById[state.chainId]) {
    state.chainId = localStorage[lsPrefix + '.chainId'] = 1
  }
  // safari workaround for broken websockets
  document.addEventListener('visibilitychange', () => {
    if (state.wallet) {
      if (document.visibilityState === 'visible') {
        if (!state.wallet.socket) {
          console.log('reopening socket')
          state.wallet.openBridge()
        }
      } else {
        if (state.wallet.socket) {
          console.log('closing socket manually')
          state.wallet.closeBridge()
        }
      }
    }
  })
  // resume wallet connect session
  const wcSession = localStorage[lsPrefix + '.walletConnectSession']
  const mmSession = localStorage[lsPrefix + '.metaMaskSession']
  if (wcSession) {
    function askUserToCancel () {
      if (window.confirm('Failed to resume wallet connect session, keep trying?')) {
        timeout = setTimeout(askUserToCancel, 5 * 1000)
      } else {
        state.disconnect()
      }
    }
    let timeout = setTimeout(askUserToCancel, 5 * 1000)
    try {
      await state.connect(wcSession)
      clearTimeout(timeout)
    } catch (err) {
      clearTimeout(timeout)
      alert(err.message)
    }
  } else if (mmSession) {
    try {
      await state.connectExtension()
      state.change()
    } catch (err) {
      alert(err.message)
      state.disconnect()
    }
  } else {
    state.change()
  }
}

main()
