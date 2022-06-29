const template = document.createElement('template')
template.innerHTML = `<h1>404</h1>
<div>Not found</div>`

class NotFound extends HTMLElement {
  connectedCallback () {
    this.appendChild(template.content.cloneNode(true))
  }
}

customElements.define('x-not-found', NotFound)
