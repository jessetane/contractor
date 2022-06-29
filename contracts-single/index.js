import hb from 'hyperbind'
import state from '../state/index.js'
import '../contracts-meta/index.js'

const template = document.createElement('template')
template.innerHTML = `<x-contracts-meta></x-contracts-meta>
<div id=properties>
  <h2>ABI</h2>
  <div id=sections>
    <div id=events class="property-group hidden">
      <h3>Events</h3>
      <div id=index></div>
    </div>
    <div id=readable class="property-group hidden">
      <h3>Readable</h3>
      <div id=index></div>
    </div>
    <div id=writable class="property-group hidden">
      <h3>Writable</h3>
      <div id=index></div>
    </div>
  </div>
</div>`

class ContractsSingle extends HTMLElement {
  constructor () {
    super()
    this.render = this.render.bind(this)
  }

  async connectedCallback () {
    state.addEventListener('change', this.render)
    this.appendChild(template.content.cloneNode(true))
    this.meta = this.querySelector('x-contracts-meta')
    state.change()
  }
  
  disconnectedCallback () {
    state.removeEventListener('change', this.render)
  }

  render () {
    const loading = this.meta.loading
    const contract = this.meta.contract
    const events = []
    const readable = []
    const writable = []
    const iface = contract
      ? (contract.proxy ? contract.proxy.iface : contract.iface).interface
      : null
    if (iface) {
      for (let name in iface.functions) {
        let f = iface.functions[name]
        const nameUrlSafe = encodeURIComponent(name)
        if (f.stateMutability === 'view' || f.stateMutability === 'pure') {
          readable.push({ name, nameUrlSafe })
        } else {
          writable.push({ name, nameUrlSafe })
        }
      }
      for (let name in iface.events) {
        const nameUrlSafe = encodeURIComponent(name)
        events.push({ name, nameUrlSafe })
      }
    }
    hb(this, {
      '#properties': { $class: { hidden: loading || !iface }},
      '#events': this._generatePropertyGroupTemplate(events),
      '#readable': this._generatePropertyGroupTemplate(readable),
      '#writable': this._generatePropertyGroupTemplate(writable)
    })
  }

  _generatePropertyGroupTemplate (group) {
    return {
      $class: { hidden: group.length === 0 },
      '#index': {
        $list: {
          key: 'name',
          items: group,
          createElement: function () {
            return document.createElement('a')
          },
          each: a => {
            a.textContent = a.item.name
            a.href = `/contracts/${this.meta.contract.normalized}/${a.item.nameUrlSafe}${state.url.search}`
          }
        }
      }
    }
  }
}

customElements.define('x-contracts-single', ContractsSingle)
