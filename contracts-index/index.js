import hb from 'hyperbind'
import state from '../state/index.js'
import '../contracts-recent/index.js'

class ContractsIndex extends HTMLElement {
  constructor () {
    super()
    this.render = this.render.bind(this)
  }

  connectedCallback () {
    state.addEventListener('change', this.render)
    this.innerHTML = `<h1>Contracts</h1>
<form id=lookup class=hidden>
  <input name=address type=text placeholder="Contract address" class=field>
  <textarea name=abi placeholder="ABI (leave blank to fetch from network's ABI URL)"></textarea>
  <button type=submit>Lookup</button>
</form>
<x-contracts-recent></x-contracts-recent>`
    this.addEventListener('submit', async () => {
      const address = this.querySelector('[name=address]').value
      const abi = this.querySelector('[name=abi]').value
      try {
        const contract = await state.loadContract(address, undefined, { abi })
        const hasFunctions = contract.abi.find(p => p.type === 'function')
        state.url.push('/contracts/' + address + (hasFunctions ? '' : '?proxy'))
      } catch (err) {
        alert(err.message)
      }
    })
    this.render()
  }
  
  disconnectedCallback () {
    state.removeEventListener('change', this.render)
  }

  render () {
    hb(this, {
      form: {
        $class: { hidden: !state.network }
      }
    })
  }
}

customElements.define('x-contracts-index', ContractsIndex)
