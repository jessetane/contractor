import hb from 'hyperbind'
import state from '../state/index.js'
import '../modal/index.js'

class Nav extends HTMLElement {
  constructor () {
    super()
    this.render = this.render.bind(this)
  }

  connectedCallback () {
    state.addEventListener('change', this.render)
    this.innerHTML = `<a href=/>Home</a>
<a href=/contracts>Contracts</a>
<a href=/networks>Networks</a>
<div id=account></div>
<div id=block-number></div>
<select id=network name=network></select>
<button id=connect class=hidden>Connect</button>
<button id=disconnect class=hidden>Disconnect</button>`
    this.querySelector('#connect').addEventListener('click', async () => {
      try {
        await state.connect()
      } catch (err) {
        if (state.wallet) {
          alert(err.message)
          state.wallet.destroySession()
        }
      }
    })
    this.querySelector('#disconnect').addEventListener('click', async () => {
      await state.disconnect()
    })
    this.querySelector('#network').addEventListener('change', evt => {
      state.network = evt.target.value
    })
    state.addEventListener('sessionCreate', evt => {
      const modal = document.createElement('x-modal')
      modal.uri = evt.uri
      modal.addEventListener('cancel', async () => {
        await state.disconnect()
      })
      document.body.appendChild(modal)
      this.render()
    })
    this.render()
  }

  render () {
    const network = state.network
    hb(this, {
      '#account': {
        $text: !network
          ? 'Connecting...'
          : (state.account || '')
      },
      '#block-number': state.blockNumber,
      '#network': {
        $attr: {
          disabled: !state.network || state.account ? 'disabled' : null
        },
        $list: {
          key: 'chainId',
          items: state.networks,
          createElement: function () {
            return hb('<option></option>')
          },
          each: el => {
            el.value = el.item.chainId
            el.textContent = el.item.chainName || el.item.chainId
            el.selected = state.network && el.item.chainId === state.chainId
          }
        }
      },
      '#connect': {
        $class: { hidden: !state.network || state.account }
      },
      '#disconnect': {
        $class: { hidden: !state.network || !state.account }
      }
    })
  }
}

customElements.define('x-nav', Nav)
