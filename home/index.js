import hb from 'hyperbind'
import state from '../state/index.js'
import '../contracts-recent/index.js'

const template = document.createElement('template')
template.innerHTML = `<h1>Contractor</h1>
<h2>About</h2>
<div id=content>This tool can automatically generate a user interface for any contract you have an ABI for. Click <a href=/contracts>here</a> to lookup a contract by its address or ENS name. The source code can be found at <a href=https://github.com/jessetane/contractor>https://github.com/jessetane/contractor</a>.
</div>
<x-contracts-recent></x-contracts-recent>`

class Home extends HTMLElement {
  constructor () {
    super()
    this.render = this.render.bind(this)
  }

  connectedCallback () {
    this.appendChild(template.content.cloneNode(true))
    state.addEventListener('change', this.render)
    this.render()
  }

  disconnectedCallback () {
    state.removeEventListener('change', this.render)
  }

  render () {
  }
}

customElements.define('x-home', Home)
