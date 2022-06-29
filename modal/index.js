import state from '../state/index.js'
import qrcode from '../qrcode/index.js'

class Modal extends HTMLElement {
  connectedCallback () {
    this.innerHTML = `
  <div id=image></div>
  <div id=text></div>`
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
    this.addEventListener('click', evt => {
      if (evt.target === this) {
        this.remove()
        this.dispatchEvent(new Event('cancel'))
      }
    })
    state.addEventListener('change', () => {
      this.remove()
    })
  }
}

customElements.define('x-modal', Modal)
