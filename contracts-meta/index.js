import hb from 'hyperbind'
import state from '../state/index.js'

const template = document.createElement('template')
template.innerHTML = `<h1 id=title><a></a></h1>
<h2 id=impl class=hidden><span></span><a></a></h2>
<div id=actions class=row>
  <button id=tag class=hidden></button>
  <button id=recent class=hidden></button>
  <button id=mode class=hidden></button>
</div>`

class ContractsMeta extends HTMLElement {
  constructor () {
    super()
    this.render = this.render.bind(this)
  }

  async connectedCallback () {
    state.addEventListener('change', this.render)
    this.appendChild(template.content.cloneNode(true))
    this.querySelector('#mode').addEventListener('click', () => {
      state.url.query({ proxy: state.url.params.proxy === undefined ? '' : null })
    })
    this.querySelector('#tag').addEventListener('click', () => {
      const tag = prompt('Enter tag name or leave empty to clear', this.contract.name || '')
      if (tag === null) return
      this.contract.name = tag
      this.contract.searched = true
      state.saveMeta(this.contract.normalized, this.contract)
      state.change()
    })
    this.querySelector('#recent').addEventListener('click', () => {
      if (this.contract.searched) {
        delete this.contract.searched
      } else {
        this.contract.searched = true
      }
      state.saveMeta(this.contract.normalized, this.contract)
      state.change()
    })
  }
  
  disconnectedCallback () {
    state.removeEventListener('change', this.render)
  }

  async render () {
    const network = state.network
    if (!network) {
      this.loading = true
    } else if (!this.href) {
      this.loading = false
    }
    const networkChanged = this.network !== network
    if (networkChanged) delete this.contract
    this.network = network
    const urlChanged = this.href !== state.url.href
    if (!this.loading && (urlChanged || networkChanged)) {
      this.loading = true
      this.href = state.url.href
      delete this.error
      const pathname = state.url.pathname.split('/')
      const address = pathname[2]
      const proxy = state.url.params.proxy
      state.change()
      state.loadContract(address, proxy, this.contract).then(contract => {
        this.loading = false
        this.contract = contract
        this.pathbase = pathname[1]
        if (address !== contract.normalized || (proxy && proxy !== contract.proxy.resolved)) {
          state.url.push({
            pathname: `/${pathname[1]}/${this.contract.normalized}`,
            query: { proxy: proxy ? contract.proxy.resolved : proxy === '' ? '' : null }
          }, true)
        } else {
          this.dispatchEvent(new Event('load'))
          state.change()
        }
      }).catch(err => {
        this.loading = false
        this.error = err
        delete this.contract
        state.change()
      })
    }
    const error = this.error
    const loading = this.loading
    const contract = this.contract || {}
    const pathbase = this.pathbase || ''
    hb(this, {
      '#title a': {
        $attr: { href: !loading && contract.normalized ? `/${pathbase}/${contract.normalized}${state.url.search}` : null },
        $text: loading ? 'Loading...' : error ? error.message : (contract.name || contract.normalized)
      },
      '#impl': {
        $class: { hidden: loading || error || !contract.proxy }
      },
      '#impl a': {
        $attr: { href: contract.proxy ? `/${pathbase}/${contract.proxy.resolved}` : null },
        $text: contract.proxy ? `Implementation: ${contract.proxy.name || contract.proxy.normalized}` : '',
      },
      '#tag': {
        $text: contract.name ? 'Retag' : 'Tag',
        $class: { hidden: loading || error }
      },
      '#recent': {
        $text: contract.searched ? 'Forget' : 'Remember',
        $class: { hidden: loading || error }
      },
      '#mode': {
        $class: { hidden: loading },
        $text: state.url.params.proxy === undefined ? 'View as proxy' : 'View standalone'
      }
    })
  }
}

customElements.define('x-contracts-meta', ContractsMeta)
