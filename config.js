// GitHub Pages muestra el catálogo; Cloudflare ejecuta el pago seguro.
window.STRIPE_CHECKOUT_ENDPOINT = location.hostname.endsWith('github.io') ? '' : '/api/checkout';
