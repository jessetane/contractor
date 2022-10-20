import hb from 'hyperbind'
import watchTx from 'eth-scripts/watch-tx.js'
import getRevertReason from 'eth-scripts/get-revert-reason.js'
import abiv2 from 'eth-scripts/abiv2.js'
import state from '../state/index.js'
import '../contracts-meta/index.js'

const template = document.createElement('template')
template.innerHTML = `<x-contracts-meta></x-contracts-meta>
<h2 id=property class=hidden></h2>
<form id=input class=hidden>
  <fieldset></fieldset>
  <div class=row>
    <button id=run class=hidden type=submit></button>
    <button id=call class=hidden type=submit>Call</button>
    <!--<button id=sign class=hidden type=submit>Sign</button>-->
    <button id=send class=hidden type=submit>Send</button>
  </div>
</form>
<div id=output class=hidden></div>`

class ContractsProperty extends HTMLElement {
  constructor () {
    super()
    this.render = this.render.bind(this)
    this.run = this.run.bind(this)
  }

  async connectedCallback () {
    state.addEventListener('change', this.render)
    this.appendChild(template.content.cloneNode(true))
    this.meta = this.querySelector('x-contracts-meta')
    this.meta.addEventListener('load', () => delete this.output)
    this.querySelector('#input').addEventListener('submit', this.run)
    this.addEventListener('change', evt => {
      const name = evt.target?.parentElement?.item?.name
      if (!name) return
      const value = evt.target?.value
      const cacheKey = `contractor.values.${state.network.chainId}.${state.url.pathname}.${name}`
      if (value) {
        localStorage[cacheKey] = value
      } else {
        delete localStorage[cacheKey]
      }
    })
    state.change()
  }

  disconnectedCallback () {
    state.removeEventListener('change', this.render)
  }

  async render () {
    const loading = this.meta.loading
    const contract = this.meta.contract
    const pathname = state.url.pathname.split('/')
    const propertyName = decodeURIComponent(pathname[3])
    delete this.property
    let property = {}
    if (contract) {
      const iface = (contract.proxy ? contract.proxy.iface : contract.iface).interface
      property = iface.events[propertyName] || iface.functions[propertyName]
      if (property) {
        let uiType = ''
        if (property.type === 'event') {
          uiType = 'event'
        } else if (property.stateMutability === 'view' || property.stateMutability === 'pure') {
          uiType = 'read'
        } else {
          uiType = 'write'
        }
        property = this.property = Object.assign({ signature: propertyName, uiType }, property)
      } else {
        property = { signature: 'Unkown property ' + propertyName }
      }
    }
    const inputs = []
    const inputsRaw = (property.inputs || []).filter(input => input.indexed !== false)
    inputsRaw.forEach(input => {
      if (input.type === 'tuple') {
        input.components.forEach(c => {
          inputs.push({
            name: `${input.name}.${c.name}`,
            type: c.type,
            tuple: true
          })
        })
      } else {
        inputs.push(input)
      }
    })
    let action = 'Read'
    if (property.uiType === 'write') {
      action = 'Encode'
      inputs.push({
        name: 'value',
        description: ' (N/A for encode)',
        type: 'Ether'
      })
    } else if (property.uiType === 'event') {
      action = 'List'
    }
    const operating = this.operating
    const output = operating ? 'Operation in progress...' : this.output
    const hideExtendedWriteUI = loading || operating || !property.name || property.uiType !== 'write'
    const cacheKey = `contractor.values.${state.network.chainId}.${state.url.pathname}`
    hb(this, {
      '#property': {
        $class: { hidden: loading },
        $text: property.signature
      },
      '#input': {
        $class: { hidden: loading || !property.name }
      },
      '#input fieldset': {
        $class: { hidden: inputs.length === 0 },
        $list: {
          key: 'name',
          items: inputs,
          createElement: function () {
            return hb('<div class=field><label class=label></label><input></input></div>')
          },
          each: (el, item) => {
            const name = item.name ? item.name : item.type
            hb(el, {
              'label': name[0].toUpperCase() + name.slice(1) + (item.description || ''),
              'input': {
                $attr: {
                  name: item.name,
                  type: 'text',
                  placeholder: item.type,
                  value: localStorage[`${cacheKey}.${name}`] || ''
                }
              }
            })
          }
        }
      },
      '#run': {
        $class: { hidden: loading || !property.name },
        $text: operating ? 'Cancel' : action
      },
      '#call': {
        $class: { hidden: hideExtendedWriteUI }
      },
      '#sign,#send': {
        $class: { hidden: hideExtendedWriteUI || !state.account }
      },
      '#output': {
        $class: { hidden: loading || !property.name || !output },
        $html: output || ''
      }
    })
  }

  async run (evt) {
    this.output = ''
    if (this.operating) {
      delete this.operating
      state.change()
      return
    }
    const contract = this.meta.contract
    const property = this.property
    if (!contract) {
      alert('Missing contact')
      return
    } else if (!property) {
      alert('Unkown property')
      return
    }
    const iface = contract.proxy ? contract.proxy.iface : contract.iface
    const args = []
    let tuple = null
    let txValue = undefined
    let sawEmpty = 0
    Array.from(this.querySelectorAll('input')).forEach(input => {
      let value = input.value
      if (input.name === 'value') {
        txValue = state.ethers.utils.parseEther(value || '0')
      } else if (value) {
        if (sawEmpty) {
          sawEmpty = 2
          return
        }
        if (input.placeholder.match(/\[\]$/)) {
          value = value.split(',').map(i => i.trim())
        }
        if (input.parentElement.item.tuple) {
          if (tuple === null) {
            tuple = [value]
          } else {
            tuple.push(value)
          }
        } else {
          if (tuple) {
            args.push(tuple)
            tuple = null
          }
          args.push(value)
        }
      } else {
        sawEmpty = 1
      }
    })
    if (sawEmpty === 2) {
      alert('Missing argument')
      return
    }
    if (tuple) {
      args.push(tuple)
    }
    let output = ''
    const operating = Math.random()
    this.operating = operating
    state.change()
    try {
      switch (property.uiType) {
        case 'read':
          let blockTag = 'latest'
          output = await iface[property.name](...args, { blockTag })
          if (typeof output !== 'string') {
            output = abiv2(output, true)
            output = JSON.stringify(output, null, 2)
          }
          break
        case 'write':
          const tx = await iface.populateTransaction[property.name](...args)
          tx.from = state.account
          if (!txValue.isZero()) {
            tx.value = txValue.toHexString()
          }
          const btn = evt.submitter.id
          if (btn === 'call') {
            try {
              let ret = await state.network.provider.call(tx)
              if (ret === '0x') {
                output = 'Success'
              } else if (ret.slice(0, 10) === '0x08c379a0') {
                const stringLength = state.ethers.BigNumber.from(`0x${ret.slice(2 + 4 * 2 + 32 * 2).slice(0, 32 * 2)}`).toNumber()
                const reason = `0x${ret.substr(138).slice(0, stringLength * 2)}`
                output = state.ethers.utils.toUtf8String(reason)
              } else {
                ret = iface.interface.decodeFunctionResult(property.name, ret)
                if (property.name.indexOf('multicall') === 0) {
                  ret = ret.results.map((r, i) => {
                    const hash = args[0][i].slice(0, 10)
                    return iface.interface.decodeFunctionResult(hash, r)
                  })
                }
                ret = abiv2(ret, true)
                output = JSON.stringify(ret, null, 2)
              }
            } catch (err) {
              while (err.error) err = err.error
              output = err.message
            }
          } else if (btn === 'sign') {
            output = await state.call('eth_sign', state.account, JSON.stringify(tx))
          } else if (btn === 'send') {
            output = await state.call('eth_sendTransaction', tx)
          } else {
            output = tx.data
          }
          break
        case 'event':
          const page = 1
          const size = 1000
          const currentBlock = await state.network.provider.getBlockNumber()
          const start = currentBlock - size * page
          const end = start + size
          const filter = iface.filters[property.name]
          const events = await iface.queryFilter(filter(...args), start, end)
          output = events.map(evt => {
            const line = {}
            property.inputs.forEach((input, i) => {
              let arg = evt.args[i]
              if (arg instanceof state.ethers.BigNumber) {
                arg = arg.toString()
              } else if (Array.isArray(arg)) {
                arg = arg.map(a => a instanceof state.ethers.BigNumber ? a.toString() : a).join(', ')
              }
              line[input.name] = arg // instanceof state.ethers.BigNumber ? arg.toString() : arg
              line.transaction = evt.transactionHash
            })
            return line
          })
          output = JSON.stringify(output, null, 2)
          break
        default:
          throw new Error('unkown property type: ' + property.uiType)
      }
    } catch (err) {
      output = err.message 
    }
    if (operating !== this.operating) return
    delete this.operating
    this.output = output
    state.change()
  }
}

customElements.define('x-contracts-property', ContractsProperty)
