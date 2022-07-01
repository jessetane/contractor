import state from '../state/index.js'
import qrcode from '../qrcode/index.js'

class Modal extends HTMLElement {
  constructor () {
    super()
    this.render = this.render.bind(this)
  }

  connectedCallback () {
    this.innerHTML = `<div id=image></div>
<div id=text></div>
<button id=extension>MetaMask extension</button>
<a href=${this.uri}>Generic/Android style deeplink</a>
<a href=https://metamask.app.link/wc?uri=${encodeURIComponent(this.uri)}>MetaMask universal link</a>`
    const typeNumber = 9
    const errorCorrectionLevel = 'L'
    const qr = qrcode(typeNumber, errorCorrectionLevel)
    qr.addData(this.uri)
    qr.make()
    const image = this.querySelector('#image')
    const html = qr.createSvgTag(16, 0)
    image.innerHTML = html
    const svg = image.firstElementChild
    svg.setAttribute('width', '256px')
    svg.setAttribute('height', '256px')
    const text = this.querySelector('#text')
    text.innerText = this.uri
    this.addEventListener('click', async evt => {
      const target = evt.target
      if (target === this) {
        this.remove()
        this.dispatchEvent(new Event('cancel'))
      } else if (target.nodeName === 'A') {
        state.wallet.deeplink = target.href.split('?')[0]
      } else if (target.nodeName === 'BUTTON') {
        try {
          await state.connectExtension()
          state.wallet.destroySession()
        } catch (err) {
          alert(err.message)
        }
      }
    })
    state.addEventListener('change', this.render)
    this.render()
  }

  disconnectedCallback () {
    state.removeEventListener('change', this.render)
  }

  render () {
    const extension = this.querySelector('#extension')
    if (!window.ethereum || !ethereum.isConnected()) {
      extension.classList.add('hidden')
    } else {
      extension.classList.remove('hidden')
    }
    if (!state.wallet || state.wallet.destroyed || state.wallet.peerAccounts.length) {
      this.remove()
    }
  }
}

customElements.define('x-modal', Modal)
