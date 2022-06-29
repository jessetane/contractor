import hb from 'hyperbind'
import state from '../state/index.js'

class ContractsRecent extends HTMLElement {
  constructor () {
    super()
    this.render = this.render.bind(this)
  }

  connectedCallback () {
    this.innerHTML = `<h2></h2>
<div id=index></div>
<button id=clear>Clear</button>`
    this.querySelector('#clear').addEventListener('click', evt => {
      if (window.confirm('Are you sure?')) {
        state.recentAbis = null
      }
    })
    state.addEventListener('change', this.render)
    this.render()
  }

  disconnectedCallback () {
    state.removeEventListener('change', this.render)
  }

  render () {
    const seen = {}
    const recents = state.recentAbis
    hb(this, {
      'h2': state.network ? 'Recently viewed' : 'Loading...',
      '#index': {
        $class: { hidden: !state.network },
        $list: {
          key: 'key',
          empty: 'No contracts found',
          items: recents,
          createElement: function () {
            return document.createElement('a')
          },
          each: a => {
            const hasFunctions = a.item.abi.find(p => p.type === 'function')
            a.setAttribute('href', '/contracts/' + a.item.key + (hasFunctions ? '' : '?proxy'))
            a.textContent = a.item.name || a.item.key
          }
        }
      },
      '#clear': {
        $class: { hidden: !state.network || recents.length === 0 }
      }
    })
  }
}

customElements.define('x-contracts-recent', ContractsRecent)
