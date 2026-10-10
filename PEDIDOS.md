# Activación de pedidos

Sin servicio de correo adicional. El panel consulta D1 cada 30 segundos mientras está visible. Sonido opcional, solo con el panel abierto. No son notificaciones push.

1. Publicar el Worker. La tabla `orders` se crea automáticamente sin alterar el catálogo.
2. En Stripe, modo real, Workbench → Webhooks → añadir destino a:
   `https://la-vie-en-rose.merojasbotello.workers.dev/api/stripe/webhook`
3. Elegir eventos `checkout.session.completed` y `checkout.session.async_payment_succeeded` de esta cuenta (eventos snapshot).
4. Copiar el secreto del destino `whsec_…` a Cloudflare → Worker → Settings → Variables and Secrets, tipo Secret, nombre `STRIPE_WEBHOOK_SECRET`. No ponerlo en Git ni enviarlo por chat. Publicar la variable.
5. Reenviar un evento de Checkout pagado desde Stripe y comprobar respuesta 200 y pedido en /admin. Reenviarlo otra vez no debe crear duplicados ni modificar el estado de preparación.

Mientras falta el webhook, el panel muestra un aviso. El retorno del cliente tras pagar también registra el pedido, pero NO sustituye al webhook.

Para recuperar compras anteriores usar en el panel el ID `cs_live_…` de su Checkout. Se verifica con la cuenta Stripe configurada. No se generan pagos, emails ni facturas.

Datos personales solo en API protegida por la sesión administrativa. Lista limitada a los 500 pedidos recientes; los anteriores permanecen en D1. El estado de preparación no equivale a devolución/cancelación del cobro. Reembolsos se gestionan en Stripe y aún no se sincronizan en este panel.
