const $ = selector => document.querySelector(selector);
const euro = value => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value);
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let products = [];

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
async function loadProducts() { products = await api('/api/admin/products'); render(); }
async function showDashboard() { $('#login-view').hidden = true; $('#dashboard').hidden = false; await loadProducts(); }
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
$('#product-list').addEventListener('click', event => { const row=event.target.closest('.product-row'); if(row) openEditor(products.find(p=>p.id===row.dataset.id)); });
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click',()=>$('#editor').close()));
$('#product-form').addEventListener('submit', async event => {
  event.preventDefault(); const save=$('#save-product'); save.disabled=true; save.textContent='Guardando…';
  try {
    let image=$('#image-url').value; const file=$('#image-file').files[0];
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
