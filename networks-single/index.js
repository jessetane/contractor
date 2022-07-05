import hb from 'hyperbind'
import state from '../state/index.js'

class NetworksSingle extends HTMLElement {
  constructor () {
    super()
    this.render = this.render.bind(this)
  }

  connectedCallback () {
    state.addEventListener('change', this.render)
    this.innerHTML = `<h1>Networks</h1>
<form>
  <div class=field>
    <label class=label>Chain ID</label>
    <input type=text name=chainId>
  </div>
  <div class=field>
    <label class=label>Name</label>
    <input type=text name=chainName>
  </div>
  <div class=field>
    <label class=label>RPC URLs</label>
    <input type=text name=rpcUrls placeholder="Comma separated">
  </div>
  <div class=field>
    <label class=label>ABI URL</label>
    <input type=text name=abiUrl placeholder="Etherscan or static file server URL">
  </div>
  <div class=row>
    <button id=add-to-wallet type=button>Add to wallet</button>
    <button id=delete type=button>Delete</button>
    <button id=save></button>
  </div>
</from>`
    this.querySelector('#add-to-wallet').addEventListener('click', async () => {
      const chainId = this.querySelector('[name=chainId]').value
      try {
        if (!chainId) throw new Error('Missing chainId')
        await state.addNetworkToWallet(chainId)
      } catch (err) {
        alert(err.message)
      }
    })
    this.querySelector('#delete').addEventListener('click', async () => {
      const chainId = this.querySelector('[name=chainId]').value
      try {
        if (!chainId) throw new Error('Missing chainId')
        await state.saveNetwork(chainId, null)
        state.url.push('/networks')
      } catch (err) {
        alert(err.message)
        state.change()
      }
    })
    this.addEventListener('submit', async () => {
      const chainId = this.querySelector('[name=chainId]').value
      try {
        if (!chainId) throw new Error('Missing chainId')
        await state.saveNetwork(chainId, {
          chainName: this.querySelector('[name=chainName]').value,
          rpcUrls: this.querySelector('[name=rpcUrls]').value.split(',').map(i => i.trim()),
          abiUrl: this.querySelector('[name=abiUrl]').value
        })
      } catch (err) {
        alert(err.message)
      }
      if (state.url.pathname.split('/').slice(-1)[0] === 'create') {
        state.url.push('/networks/' + chainId)
      } else {
        state.change()
      }
    })
    this.render()
  }
  
  disconnectedCallback () {
    state.removeEventListener('change', this.render)
  }

  render () {
    const chainId = state.url.pathname.split('/').slice(-1)[0]
    const isCreate = chainId === 'create'
    const network = isCreate ? {} : state.networksById[chainId]
    if (!network) {
      alert('Network not found')
      state.url.push('/networks')
      return
    }
    const bindings = {
      '#add-to-wallet': { $class: { hidden: isCreate || !state.account || state.chainId === network.chainId }},
      '#delete': { $class: { hidden: isCreate }},
      '#save': isCreate ? 'Create' : 'Save'
    }
    if (!isCreate) {
      Object.assign(bindings, {
        '[name=chainName]': { $prop: { value: network.chainName || null }},
        '[name=chainId]': { $prop: { value: network.chainId || null }},
        '[name=rpcUrls]': { $prop: { value: (network.rpcUrls || []).join(', ') }},
        '[name=abiUrl]': { $prop: { value: network.abiUrl || null }},
      })
    }
    hb(this, bindings)
  }
}

customElements.define('x-networks-single', NetworksSingle)
