import state from '../state/index.js'
import hb from '/modules/hyperbind/index.js'
import '../contracts-recent/index.js'

const etherscan = `https://api-rinkeby.etherscan.io/api?module=contract&action=getabi&address=`

class ContractsIndex extends HTMLElement {
  constructor () {
    super()
    this.render = this.render.bind(this)
  }

  connectedCallback () {
    state.addEventListener('change', this.render)
    this.innerHTML = `<h1>Contracts</h1>
<form class=hidden>
  <input name=address type=text placeholder="Contract address" class=field>
  <textarea name=abi placeholder="ABI"></textarea>
  <button type=submit>Lookup</button>
</form>
<x-contracts-recent></x-contracts-recent>`
    this.addEventListener('submit', async () => {
      const address = this.querySelector('[name=address]').value
      try {
        const contract = await state.loadContract(address)
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
        $class: { hidden: !state.chain }
      }
    })
  }
}

customElements.define('x-contracts-index', ContractsIndex)
