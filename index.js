import state from './state/index.js'
import './nav/index.js'
import './home/index.js'
import './not-found/index.js'
import './networks-index/index.js'
import './networks-single/index.js'
import './contracts-index/index.js'
import './contracts-single/index.js'
import './contracts-property/index.js'

class App extends HTMLElement {
  constructor () {
    super()
    this.render = this.render.bind(this)
  }

  connectedCallback () {
    state.addEventListener('change', this.render)
    this.views = this.querySelector('#views')
    this.render()
  }

  render () {
    const pathname = state.url.pathname
    const views = this.views
    let nodeName = null
    if (pathname.match(/^\/networks\/[^\/]+/)) {
      nodeName = 'x-networks-single'
    } else if (pathname === '/networks') {
      nodeName = 'x-networks-index'
    } else if (pathname.match(/^\/contracts\/[^\/]+\/[^\/]+/)) {
      nodeName = 'x-contracts-property'
    } else if (pathname.match(/^\/contracts\/[^\/]+/)) {
      nodeName = 'x-contracts-single'
    } else if (pathname === '/contracts') {
      nodeName = 'x-contracts-index'
    } else if (pathname === '/') {
      nodeName = 'x-home'
    } else {
      nodeName = 'x-not-found'
    }
    nodeName = nodeName.toUpperCase()
    const view = views.firstElementChild
    if (!view || view.nodeName !== nodeName) {
      if (view) {
        view.remove()
      }
      views.appendChild(
        document.createElement(nodeName)
      )
    }
  }
}

window.app = document.querySelector('x-app')
customElements.define('x-app', App)
