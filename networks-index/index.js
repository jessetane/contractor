import hb from 'hyperbind'
import state from '../state/index.js'

class NetworksIndex extends HTMLElement {
  constructor () {
    super()
    this.render = this.render.bind(this)
  }

  connectedCallback () {
    state.addEventListener('change', this.render)
    this.innerHTML = `<h1>Networks</h1>
<button id=create>Create new</button>
<div id=index></div>`
    this.querySelector('#create').addEventListener('click', async () => {
      state.url.push('/networks/create')
    })
    this.render()
  }
  
  disconnectedCallback () {
    state.removeEventListener('change', this.render)
  }

  render () {
    hb(this, {
      '#index': {
        $list: {
          key: 'chainId',
          items: state.networks.sort((a, b) => parseInt(a.chainId) - parseInt(b.chainId)),
          createElement: function () {
            return hb(`<a></a>`)
          },
          each: el => {
            el.textContent = el.item.chainName
            el.href = `/networks/${el.item.chainId}`
          }
        }
      }
    })
  }
}

customElements.define('x-networks-index', NetworksIndex)
