const $ = id => document.getElementById(id);
let previewMode = !TrackIT.configured;
let currentAdminProfile = null;
let adminDirectory = [];

const fields = {
  tracking_code:'trackingCode',
  sender_name:'senderName',
  recipient_name:'recipientName',
  origin:'origin',
  destination:'destination',
  delivery_address:'deliveryAddress',
  package_type:'packageType',
  weight:'weight',
  declared_value:'declaredValue',
  shipping_fee:'shippingFee',
  currency:'currency',
  transit_hub:'transitHub',
  customs_location:'customsLocation',
  delivery_city:'deliveryCity',
  received_date:'receivedDate',
  in_transit_date:'inTransitDate',
  customs_date:'customsDate',
  out_for_delivery_date:'outForDeliveryDate',
  delivery_date:'deliveryDate',
  manual_status:'manualStatus',
  notes:'notes'
};

function msg(t, ok=false){
  $('loginMessage').className = ok ? 'success' : 'error';
  $('loginMessage').textContent = t;
}

function adminMsg(t, ok=false){
  const el = $('adminManagerMessage');
  if(!el) return;
  el.className = ok ? 'success' : 'error';
  el.textContent = t;
}

function cleanEmail(v=''){
  return String(v).trim().toLowerCase();
}

function trackingUrl(code){
  return `${location.origin}/track/${encodeURIComponent(code)}`;
}

async function copyText(text){
  if(navigator.clipboard && window.isSecureContext){
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

async function loadMyProfile(){
  if(previewMode){
    currentAdminProfile = {
      display_name:'Preview Admin',
      payment_email:TrackIT.cfg.paymentEmail || 'trackit.space@gmail.com',
      role:'owner',
      active:true
    };
    renderProfile();
    return;
  }

  const {data:authData,error:authError} = await TrackIT.client.auth.getUser();
  if(authError) throw authError;
  const user = authData.user;
  if(!user) throw new Error('No signed-in user found.');

  const {data,error} = await TrackIT.client
    .from('admins')
    .select('user_id,display_name,payment_email,role,active')
    .eq('user_id',user.id)
    .maybeSingle();

  if(error) throw error;
  if(!data || data.active !== true){
    await TrackIT.client.auth.signOut();
    throw new Error('This account does not currently have Track IT admin access.');
  }

  currentAdminProfile = {...data,login_email:user.email};
  renderProfile();
}

function renderProfile(){
  if(!currentAdminProfile) return;
  const name = currentAdminProfile.display_name || currentAdminProfile.login_email || 'Admin';
  const role = currentAdminProfile.role === 'owner' ? 'Owner' : 'Admin';
  $('adminIdentity').textContent = `${name} · ${role}`;
  $('billingContactText').innerHTML = `Packages you create will use <strong>${TrackIT.esc(currentAdminProfile.payment_email || '')}</strong> for customer payment/support messages.`;
  $('adminManagerCard').classList.toggle('hidden', currentAdminProfile.role !== 'owner');
}

async function showAdmin(){
  $('authView').classList.add('hidden');
  $('adminView').classList.remove('hidden');
  $('modeBanner').classList.toggle('hidden', !previewMode);
  try{
    await loadMyProfile();
  }catch(e){
    alert(e.message || 'Could not load admin profile.');
    if(!previewMode){
      $('adminView').classList.add('hidden');
      $('authView').classList.remove('hidden');
      return;
    }
  }
  clearForm();
  await loadList();
  if(currentAdminProfile && currentAdminProfile.role === 'owner') await loadAdmins();
}

async function init(){
  if(!TrackIT.configured){
    $('previewBanner').classList.remove('hidden');
    $('loginFields').classList.add('hidden');
    $('previewBtn').classList.remove('hidden');
    return;
  }
  const {data} = await TrackIT.client.auth.getSession();
  if(data.session) await showAdmin();
}

$('previewBtn').onclick = showAdmin;

$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  msg('');
  try{
    const {error} = await TrackIT.client.auth.signInWithPassword({
      email:$('adminEmail').value.trim(),
      password:$('adminPassword').value
    });
    if(error) throw error;
    previewMode = false;
    await showAdmin();
  }catch(e){
    msg(e.message || 'Sign-in failed.');
  }
});

$('logoutBtn').onclick = async () => {
  if(TrackIT.client && !previewMode) await TrackIT.client.auth.signOut();
  location.reload();
};

$('generateBtn').onclick = () => {
  $('trackingCode').value = TrackIT.genCode();
};

$('clearBtn').onclick = clearForm;

function clearForm(){
  Object.values(fields).forEach(id => {
    if($(id)) $(id).value = '';
  });
  $('currency').value = 'USD';
  $('manualStatus').value = 'Auto';
  $('trackingCode').value = TrackIT.genCode();
  $('editingCode').value = '';
  $('saveBtn').textContent = 'Save Package';
}

function collect(){
  const p = {};
  for(const [k,id] of Object.entries(fields)) p[k] = $(id).value.trim();
  p.declared_value = p.declared_value ? Number(p.declared_value) : null;
  p.shipping_fee = p.shipping_fee ? Number(p.shipping_fee) : null;
  return p;
}

$('packageForm').addEventListener('submit', async e => {
  e.preventDefault();
  const p = collect();
  const btn = $('saveBtn');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try{
    const oldCode = $('editingCode').value.trim();
    await TrackIT.adminUpsert(p);
    if(oldCode && oldCode !== p.tracking_code) await TrackIT.adminDelete(oldCode);
    clearForm();
    await loadList();
  }catch(e){
    alert(e.message || 'Could not save shipment.');
  }finally{
    btn.disabled = false;
    btn.textContent = 'Save Package';
  }
});

async function loadList(){
  const root = $('packageList');
  root.innerHTML = '<div class="muted">Loading…</div>';
  try{
    const rows = await TrackIT.adminList();
    root.innerHTML = rows.map(p => {
      const creator = adminDirectory.find(a => a.user_id === p.created_by);
      const creatorLine = currentAdminProfile && currentAdminProfile.role === 'owner' && creator
        ? `<div class="package-meta">Created by: ${TrackIT.esc(creator.display_name || creator.login_email || 'Admin')}</div>`
        : '';
      return `<article class="package-card">
        <div class="package-card-head">
          <div>
            <div class="package-code">${TrackIT.esc(p.tracking_code)}</div>
            <div style="font-weight:850;margin-top:3px">${TrackIT.esc(p.recipient_name || 'Unnamed recipient')}</div>
            <div class="package-meta">${TrackIT.esc(p.destination || 'No destination')} · ${TrackIT.esc(TrackIT.fmt(p.delivery_date))}</div>
            ${creatorLine}
            <div class="package-meta">Payment/support: ${TrackIT.esc(p.payment_email || 'Not assigned')}</div>
          </div>
          <span class="small-pill">${TrackIT.esc(TrackIT.status(p))}</span>
        </div>
        <div class="package-actions">
          <button data-edit="${TrackIT.esc(p.tracking_code)}">Edit</button>
          <a href="${trackingUrl(p.tracking_code)}" target="_blank"><button type="button">Preview</button></a>
          <button data-copy="${TrackIT.esc(p.tracking_code)}">Copy Tracking Link</button>
          <button data-delete="${TrackIT.esc(p.tracking_code)}" style="color:#b42318">Delete</button>
        </div>
      </article>`;
    }).join('') || '<div class="muted">No shipment records yet.</div>';

    root.querySelectorAll('[data-edit]').forEach(b => {
      b.onclick = () => editRow(rows.find(p => p.tracking_code === b.dataset.edit));
    });
    root.querySelectorAll('[data-delete]').forEach(b => {
      b.onclick = () => deleteRow(b.dataset.delete);
    });
    root.querySelectorAll('[data-copy]').forEach(b => {
      b.onclick = async () => {
        const url = trackingUrl(b.dataset.copy);
        try{
          await copyText(url);
          const old = b.textContent;
          b.textContent = 'Copied';
          setTimeout(() => b.textContent = old, 1400);
        }catch{
          prompt('Copy this tracking link:', url);
        }
      };
    });
  }catch(e){
    root.innerHTML = `<div class="error">${TrackIT.esc(e.message || 'Could not load shipments.')}</div>`;
  }
}

function editRow(p){
  if(!p) return;
  for(const [k,id] of Object.entries(fields)) $(id).value = p[k] ?? '';
  $('editingCode').value = p.tracking_code;
  $('saveBtn').textContent = 'Update Package';
  scrollTo({top:0,behavior:'smooth'});
}

async function deleteRow(code){
  if(!confirm(`Delete ${code}?`)) return;
  try{
    await TrackIT.adminDelete(code);
    await loadList();
  }catch(e){
    alert(e.message || 'Could not delete shipment.');
  }
}

async function loadAdmins(){
  if(previewMode){
    adminDirectory = [{
      user_id:'preview-owner',
      login_email:'preview@example.com',
      display_name:'Preview Owner',
      payment_email:TrackIT.cfg.paymentEmail || 'trackit.space@gmail.com',
      role:'owner',
      active:true
    }];
    renderAdmins();
    return;
  }

  const {data,error} = await TrackIT.client.rpc('owner_list_admins');
  if(error) throw error;
  adminDirectory = data || [];
  renderAdmins();
  await loadList();
}

function renderAdmins(){
  const root = $('adminList');
  if(!root) return;
  root.innerHTML = adminDirectory.map(a => {
    const isOwner = a.role === 'owner';
    return `<article class="package-card" data-admin-card="${TrackIT.esc(a.user_id)}">
      <div class="package-card-head">
        <div>
          <div class="package-code">${TrackIT.esc(a.display_name || a.login_email || 'Admin')}</div>
          <div class="package-meta">Login: ${TrackIT.esc(a.login_email || 'Unknown')}</div>
          <div class="package-meta">Role: ${TrackIT.esc(isOwner ? 'Owner' : 'Admin')}</div>
        </div>
        <span class="small-pill">${a.active ? 'Active' : 'Disabled'}</span>
      </div>
      <div class="grid2" style="margin-top:14px">
        <div class="field">
          <label>Display name</label>
          <input class="input" data-admin-name value="${TrackIT.esc(a.display_name || '')}" ${isOwner ? '' : ''}>
        </div>
        <div class="field">
          <label>Payment / support email</label>
          <input class="input" type="email" data-admin-payment value="${TrackIT.esc(a.payment_email || '')}">
        </div>
      </div>
      <div class="package-actions">
        <button data-save-admin="${TrackIT.esc(a.user_id)}">Save Changes</button>
        ${isOwner ? '' : `<button data-remove-admin="${TrackIT.esc(a.user_id)}" style="color:#b42318">Remove Admin</button>`}
      </div>
    </article>`;
  }).join('') || '<div class="muted">No admins found.</div>';

  root.querySelectorAll('[data-save-admin]').forEach(btn => {
    btn.onclick = async () => {
      const card = btn.closest('[data-admin-card]');
      const userId = btn.dataset.saveAdmin;
      const row = adminDirectory.find(x => x.user_id === userId);
      const name = card.querySelector('[data-admin-name]').value.trim();
      const payment = cleanEmail(card.querySelector('[data-admin-payment]').value);
      if(!payment){ alert('Enter a payment/support email.'); return; }
      btn.disabled = true;
      btn.textContent = 'Saving…';
      try{
        const {error} = await TrackIT.client.rpc('owner_update_admin', {
          p_user_id:userId,
          p_display_name:name,
          p_payment_email:payment,
          p_active: row ? row.active : true
        });
        if(error) throw error;
        await loadAdmins();
      }catch(e){
        alert(e.message || 'Could not update admin.');
      }finally{
        btn.disabled = false;
        btn.textContent = 'Save Changes';
      }
    };
  });

  root.querySelectorAll('[data-remove-admin]').forEach(btn => {
    btn.onclick = async () => {
      const userId = btn.dataset.removeAdmin;
      const row = adminDirectory.find(x => x.user_id === userId);
      if(!confirm(`Remove admin access for ${row?.display_name || row?.login_email || 'this user'}? Their existing shipments will remain.`)) return;
      btn.disabled = true;
      try{
        const {error} = await TrackIT.client.rpc('owner_remove_admin', {p_user_id:userId});
        if(error) throw error;
        await loadAdmins();
      }catch(e){
        alert(e.message || 'Could not remove admin.');
      }finally{
        btn.disabled = false;
      }
    };
  });
}

$('addAdminForm').addEventListener('submit', async e => {
  e.preventDefault();
  if(previewMode){ adminMsg('Admin creation is unavailable in Preview Mode.'); return; }
  const email = cleanEmail($('newAdminEmail').value);
  const name = $('newAdminName').value.trim();
  const payment = cleanEmail($('newAdminPaymentEmail').value);
  const btn = $('addAdminBtn');
  if(!email || !payment){ adminMsg('Login email and payment email are required.'); return; }
  btn.disabled = true;
  btn.textContent = 'Adding…';
  adminMsg('');
  try{
    const {error} = await TrackIT.client.rpc('owner_add_admin', {
      p_email:email,
      p_display_name:name,
      p_payment_email:payment
    });
    if(error) throw error;
    $('addAdminForm').reset();
    adminMsg('Admin access granted.', true);
    await loadAdmins();
  }catch(e){
    adminMsg(e.message || 'Could not add admin.');
  }finally{
    btn.disabled = false;
    btn.textContent = 'Grant Admin Access';
  }
});

init();
