const $ = selector => document.querySelector(selector);
const euro = value => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let products = [], settings = null;
const weekNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
function hoursRow(day, index, date = '') {
  return `<div class="hours-row" data-day="${index}">${date ? `<label>Fecha<input type="date" class="hours-date" value="${date}" required></label>` : `<span>${weekNames[index]}</span>`}<label>Apertura<input type="time" class="hours-open" value="${day.open}" required></label><label>Cierre<input type="time" class="hours-close" value="${day.close}" required></label><label><input type="checkbox" class="hours-closed" ${day.closed ? 'checked' : ''}> Cerrado</label>${date ? '<button type="button" class="quiet remove-hours">Quitar</button>' : ''}</div>`;
}
function readHours() {
  const read = row => ({ open: row.querySelector('.hours-open').value, close: row.querySelector('.hours-close').value, closed: row.querySelector('.hours-closed').checked });
  const week = [...$('#weekly-hours').children].map(read), dates = {};
  for (const row of $('#date-hours').children) { const date = row.querySelector('.hours-date').value; if (dates[date]) throw new Error('Hay dos excepciones para la misma fecha.'); dates[date] = read(row); }
  return { week, dates };
}
$('#add-hours-date').addEventListener('click', () => { const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date()); $('#date-hours').insertAdjacentHTML('beforeend', hoursRow({open:'10:00',close:'20:30',closed:false}, '', date)); });
$('#date-hours').addEventListener('click', event => { if (event.target.closest('.remove-hours')) event.target.closest('.hours-row').remove(); });

async function optimizeImage(file) {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  let quality = .84, blob;
  do { blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality)); quality -= .08; } while (blob && blob.size > 1.35 * 1024 * 1024 && quality >= .44);
  if (!blob || blob.size > 1.5 * 1024 * 1024) throw new Error('No pudimos reducir esta foto. Elige otra imagen.');
  return new File([blob], 'producto.webp', { type: 'image/webp' });
}

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: options.body instanceof FormData ? options.headers : { 'content-type':'application/json', ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.');
  return data;
}
function notify(message, error = false) {
  const box = $('#notice'); box.textContent = message; box.hidden = false;
  box.style.background = error ? '#fff0f4' : '#e9f8ee'; box.style.color = error ? '#9c1740' : '#176236';
  clearTimeout(notify.timer); notify.timer = setTimeout(() => { box.hidden = true; }, 3500);
}
function render() {
  $('#product-count').textContent = `${products.length} productos`;
  $('#available-count').textContent = `${products.filter(p => p.active).length} disponibles en la tienda`;
  $('#product-list').innerHTML = products.length ? products.map(p => `<article class="product-row" data-id="${escapeHtml(p.id)}"><img src="${escapeHtml(p.image)}" alt=""><div class="product-copy"><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description)}</p></div><div class="price">${euro(p.price)}</div><div class="category">${escapeHtml(p.category)}</div><div class="availability ${p.active?'':'unavailable'}"><span class="dot"></span>${p.active?'Disponible':'Pausado'}</div><button class="quiet edit">Editar</button></article>`).join('') : '<div class="empty">Aún no hay productos.</div>';
}
async function loadProducts() { products = (await api('/api/admin/products')).map(product => ({...product, image: product.image.startsWith('/media/') ? `${product.image}?v=2` : product.image})); render(); }
async function loadSettings() {
  settings = await api('/api/admin/settings');
  $('#store-address').value = settings.storeAddress || '';
  $('#pickup-lead').value = settings.pickupLeadMinutes;
  $('#delivery-lead').value = settings.deliveryLeadMinutes;
  const hours = settings.hours || { week: weekNames.map(() => ({open:'10:00',close:'20:30',closed:false})), dates: {} };
  $('#weekly-hours').innerHTML = hours.week.map((day, index) => hoursRow(day, index)).join('');
  $('#date-hours').innerHTML = Object.entries(hours.dates).sort().map(([date, day]) => hoursRow(day, '', date)).join('');
  $('#resolved-address').textContent = settings.storeLat == null ? 'Añade la dirección exacta para activar el cálculo del delivery.' : 'Dirección localizada correctamente. Puedes cambiarla cuando sea necesario.';
}
async function showDashboard() { $('#login-view').hidden = true; $('#dashboard').hidden = false; await Promise.all([loadProducts(), loadSettings(), loadOrders()]); }
function openEditor(product) {
  $('#dialog-title').textContent = product ? 'Editar producto' : 'Nuevo producto';
  $('#product-id').value = product?.id || ''; $('#name').value = product?.name || ''; $('#price').value = product?.price ?? '';
  $('#category').value = product?.category || 'flores'; $('#description').value = product?.description || ''; $('#badge').value = product?.badge || '';
  $('#sort-order').value = product?.sortOrder ?? (products.length + 1) * 10; $('#image-url').value = product?.image || ''; $('#image-file').value = '';
  $('#active').checked = product ? product.active : true; $('#delete-product').hidden = !product; $('#editor').showModal();
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); $('#login-error').textContent = '';
  try { await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:$('#password').value})}); $('#password').value=''; await showDashboard(); }
  catch(error){ $('#login-error').textContent = error.message; }
});
$('#logout').addEventListener('click', async () => { await api('/api/admin/logout',{method:'POST'}); $('#dashboard').hidden=true; $('#login-view').hidden=false; });
$('#new-product').addEventListener('click', () => openEditor());
$('#settings-form').addEventListener('submit', async event => {
  event.preventDefault(); const button=$('#save-settings'); button.disabled=true; button.textContent='Localizando…';
  try {
    const result=await api('/api/admin/settings',{method:'PUT',body:JSON.stringify({storeAddress:$('#store-address').value,pickupLeadMinutes:$('#pickup-lead').value,deliveryLeadMinutes:$('#delivery-lead').value,hours:readHours()})});
    settings=result.settings; $('#resolved-address').textContent=`Ubicación reconocida: ${result.resolvedAddress}`; notify('Ajustes de pedidos actualizados.');
  } catch(error){ notify(error.message,true); } finally { button.disabled=false; button.textContent='Guardar ajustes'; }
});
$('#product-list').addEventListener('click', event => { const row=event.target.closest('.product-row'); if(row) openEditor(products.find(p=>p.id===row.dataset.id)); });
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click',()=>$('#editor').close()));
$('#product-form').addEventListener('submit', async event => {
  event.preventDefault(); const save=$('#save-product'); save.disabled=true; save.textContent='Guardando…';
  try {
    let image=$('#image-url').value.replace(/\?v=2$/, ''); const file=$('#image-file').files[0];
    if(file){ save.textContent='Preparando foto…'; const form=new FormData(); form.append('image',await optimizeImage(file)); save.textContent='Subiendo foto…'; image=(await api('/api/admin/upload',{method:'POST',body:form})).url; }
    const payload={name:$('#name').value,price:$('#price').value,category:$('#category').value,description:$('#description').value,badge:$('#badge').value,sortOrder:$('#sort-order').value,image,active:$('#active').checked};
    const id=$('#product-id').value; await api(id?`/api/admin/products/${encodeURIComponent(id)}`:'/api/admin/products',{method:id?'PUT':'POST',body:JSON.stringify(payload)});
    $('#editor').close(); await loadProducts(); notify(id?'Producto actualizado.':'Producto añadido.');
  } catch(error){ notify(error.message,true); } finally { save.disabled=false; save.textContent='Guardar cambios'; }
});
$('#delete-product').addEventListener('click', async () => {
  const id=$('#product-id').value, product=products.find(p=>p.id===id);
  if(!id || !confirm(`¿Eliminar “${product?.name}”? Esta acción no se puede deshacer.`)) return;
  try{ await api(`/api/admin/products/${encodeURIComponent(id)}`,{method:'DELETE'}); $('#editor').close(); await loadProducts(); notify('Producto eliminado.'); } catch(error){ notify(error.message,true); }
});

(async()=>{ try{ const session=await api('/api/admin/session'); if(session.authenticated) await showDashboard(); else $('#login-view').hidden=false; }catch{ $('#login-view').hidden=false; $('#login-error').textContent='No se pudo conectar con el panel.'; } })();

let orders = [], knownOrders = null, audioContext = null, loadingOrders = false;
const orderStates = {pending:'Pendiente',preparing:'En preparación',ready:'Listo',delivered:'Entregado'};
const orderDate = value => value ? new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : 'Sin fecha';
function renderOrders() {
  const pending = orders.filter(o=>o.status==='pending').length;
  $('#new-orders-count').textContent = pending ? `· ${pending} nuevos` : '';
  const today = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid'}).format(new Date());
  const deliveries = orders.filter(o=>o.deliveryAt && new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid'}).format(new Date(o.deliveryAt))===today && o.status!=='delivered').length;
  $('#orders-summary').textContent = `${pending} pendientes · ${deliveries} entregas previstas hoy · ${orders.length} pedidos registrados (máximo 500 recientes)`;
  const filter = $('#order-filter').value;
  $('#orders-list').innerHTML = orders.filter(o=>filter==='all'||o.status===filter).map(o=>{
    const phone = String(o.customer.phone || '').replace(/\D/g,'');
    const address = o.shipping?.address;
    const fullAddress = address ? [address.line1,address.line2,address.postal_code,address.city,address.state].filter(Boolean).join(', ') : o.address;
    return `<article class="order-card" data-order="${escapeHtml(o.id)}"><header><div><p class="eyebrow">${o.live?'Pago confirmado':'Prueba · no preparar'}</p><h3>${escapeHtml(o.ref)}</h3><small>Creado: ${orderDate(o.created*1000)}</small></div><strong>${euro(o.total/100)}</strong></header><ul>${o.items.map(i=>`<li>${i.quantity} × ${escapeHtml(i.name)} <span>${euro(i.total/100)}</span></li>`).join('')}</ul><p><strong>${o.fulfillment==='delivery'?'Entrega a domicilio':'Recogida en tienda'}</strong>${o.deliveryAt?` · Aproximada: ${orderDate(o.deliveryAt)}`:` · Preparación: ${o.pickupLeadMinutes} minutos laborables`}</p>${fullAddress?`<p>Dirección: ${escapeHtml(fullAddress)}</p>`:''}<p>Cliente: ${escapeHtml(o.customer.name||'—')} · ${escapeHtml(o.customer.email||'—')} · ${escapeHtml(o.customer.phone||'—')}</p><p>Destinatario: ${escapeHtml(o.recipient||'—')}</p>${o.dedication?`<blockquote>${escapeHtml(o.dedication)}</blockquote>`:''}<footer><label>Estado<select class="order-status">${Object.entries(orderStates).map(([value,label])=>`<option value="${value}" ${o.status===value?'selected':''}>${label}</option>`).join('')}</select></label>${phone?`<a target="_blank" rel="noopener" href="https://wa.me/${phone}?text=${encodeURIComponent(`Hola, te escribimos de La Vie en Rose sobre tu pedido ${o.ref}.`)}">WhatsApp</a>`:''}<button type="button" class="quiet print-order">Imprimir ficha</button></footer></article>`;
  }).join('') || '<p class="empty">No hay pedidos en este apartado.</p>';
}
async function loadOrders() {
  if(loadingOrders) return; loadingOrders=true;
  try {
    const result = await api('/api/admin/orders');
    const fresh = knownOrders && result.orders.some(o=>!knownOrders.has(o.id));
    orders=result.orders; knownOrders=new Set(orders.map(o=>o.id));
    $('#webhook-warning').hidden=result.webhookConfigured;
    $('#orders-error').textContent=''; renderOrders();
    if(fresh) {notify('Ha llegado un nuevo pedido.'); if($('#order-sound').checked && audioContext) {const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();gain.gain.value=.08;oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start();oscillator.stop(audioContext.currentTime+.25);} }
  } catch(error){$('#orders-error').textContent=`No se pudieron actualizar los pedidos: ${error.message}`;} finally{loadingOrders=false;}
}
$('#refresh-orders').addEventListener('click',loadOrders);
$('#order-filter').addEventListener('change',renderOrders);
$('#order-sound').addEventListener('change',async()=>{if($('#order-sound').checked){audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); await audioContext.resume();}});
$('#orders-list').addEventListener('change',async event=>{
  if(!event.target.matches('.order-status'))return;
  const select=event.target, id=select.closest('[data-order]').dataset.order; select.disabled=true;
  try{await api(`/api/admin/orders/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify({status:select.value})}); await loadOrders(); notify('Estado actualizado.');}catch(error){notify(error.message,true);renderOrders();}finally{select.disabled=false;}
});
$('#orders-list').addEventListener('click',event=>{if(event.target.closest('.print-order')){const card=event.target.closest('.order-card');card.classList.add('printing');window.print();card.classList.remove('printing');}});
$('#import-order').addEventListener('submit',async event=>{event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;try{const result=await api('/api/admin/orders/import',{method:'POST',body:JSON.stringify({sessionId:$('#import-session').value.trim()})});notify(result.ok?'Pedido recuperado.':'La sesión no es un pedido pagado de esta tienda.',!result.ok);await loadOrders();}catch(error){notify(error.message,true);}finally{button.disabled=false;}});
setInterval(()=>{if(!$('#dashboard').hidden && !document.hidden)loadOrders();},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('#dashboard').hidden)loadOrders();});
