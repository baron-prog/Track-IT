
const $=id=>document.getElementById(id);let currentShipment=null;
function mailto(p){const email=(p.payment_email||TrackIT.cfg.paymentEmail||'trackit.space@gmail.com').trim();const subject=encodeURIComponent(`Shipment inquiry - ${p.tracking_code}`);const body=encodeURIComponent(`Hello Track IT,\n\nI am contacting you about this shipment:\nTracking code: ${p.tracking_code}\nRecipient: ${p.recipient_name||'N/A'}\nDestination: ${p.destination||'N/A'}\nAmount: ${p.currency||'USD'} ${p.shipping_fee||'0.00'}\nEstimated delivery: ${TrackIT.fmt(p.delivery_date)}\n\nPlease send the next instructions.`);return `mailto:${email}?subject=${subject}&body=${body}`}
function icon(name){
  const map={
    user:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.3 0-8 2.2-8 5v1h16v-1c0-2.8-3.7-5-8-5Z"/></svg>',
    package:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 6v12l8 4 8-4V6l-8-4Zm0 2.2L17.2 7 12 9.6 6.8 7 12 4.2ZM6 8.7l5 2.5v8.2l-5-2.5V8.7Zm7 10.7v-8.2l5-2.5v8.2l-5 2.5Z"/></svg>',
    pin:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Zm0-9.2a2.8 2.8 0 1 1 0-5.6 2.8 2.8 0 0 1 0 5.6Z"/></svg>',
    calendar:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v3H7V2Zm8 0h2v3h-2V2ZM4 5h16a1 1 0 0 1 1 1v13.5A2.5 2.5 0 0 1 18.5 22h-13A2.5 2.5 0 0 1 3 19.5V6a1 1 0 0 1 1-1Zm0 5v9.5c0 .8.7 1.5 1.5 1.5h13c.8 0 1.5-.7 1.5-1.5V10H4Z"/></svg>',
    card:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Zm0 3.5h18V8H3v2Zm4 6h4v2H7v-2Z"/></svg>',
    arrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 5.5 11.6 7l4.4 4.4H5v2h11l-4.4 4.4 1.4 1.4L20 12 13 5.5Z"/></svg>'
  };
  return map[name]||'';
}
function render(p,historyMode='none'){
  currentShipment=p;
  if(historyMode!=='none'){
    const cleanPath='/track/'+encodeURIComponent(p.tracking_code);
    const state={tracking:p.tracking_code};
    if(historyMode==='push') history.pushState(state,'',cleanPath);
    else history.replaceState(state,'',cleanPath);
  }
  const m=TrackIT.milestones(p);
  const doneCount=m.filter(([k])=>TrackIT.passed(p[k])).length;
  const delivered=TrackIT.passed(p.delivery_date);
  const currentIndex=delivered?m.length-1:Math.min(Math.max(doneCount-1,0),m.length-1);
  const timeline=m.map(([k,l,d],i)=>{
    const state=i<currentIndex?'done':i===currentIndex?'current':'future';
    return `<div class="progress-item ${state}">
      <div class="progress-rail"><span class="progress-node">${i===currentIndex?icon('arrow'):''}</span></div>
      <div class="progress-body ${i===currentIndex?'is-current-card':''}">
        <h4>${TrackIT.esc(l)}</h4>
        <p>${TrackIT.esc(TrackIT.fmt(p[k]))} · ${TrackIT.esc(d)}</p>
      </div>
    </div>`;
  }).join('');

  $('trackingResult').innerHTML=`
  <div class="tracking-result tracking-result-modern">
    <div class="result-head result-head-modern">
      <div>
        <small>TRACKING NUMBER</small>
        <div class="tracking-code-large">${TrackIT.esc(p.tracking_code)}</div>
      </div>
      <span class="status-pill">${TrackIT.esc(TrackIT.status(p))}</span>
    </div>

    <div class="result-main modern-stack">
      <div class="overview-grid">
        <div class="overview-card">
          <div class="overview-icon">${icon('user')}</div>
          <div class="overview-copy"><label>Recipient</label><strong>${TrackIT.esc(p.recipient_name||'Not provided')}</strong></div>
        </div>
        <div class="overview-card">
          <div class="overview-icon">${icon('package')}</div>
          <div class="overview-copy"><label>Package</label><strong>${TrackIT.esc(p.package_type||'Parcel')}${p.weight?' · '+TrackIT.esc(p.weight):''}</strong></div>
        </div>
        <div class="overview-card">
          <div class="overview-icon">${icon('pin')}</div>
          <div class="overview-copy"><label>Current checkpoint</label><strong>${TrackIT.esc(TrackIT.checkpoint(p))}</strong></div>
        </div>
        <div class="overview-card">
          <div class="overview-icon">${icon('calendar')}</div>
          <div class="overview-copy"><label>Estimated delivery</label><strong>${TrackIT.esc(TrackIT.fmt(p.delivery_date))}</strong></div>
        </div>
      </div>

      <div class="tracking-progress-card">
        ${timeline}
      </div>

      <div class="location-amount-grid">
        <div class="route-card route-card-modern">
          <div class="route-flow">
            <div class="route-marker start">${icon('pin')}</div>
            <div class="route-content">
              <small>From</small>
              <strong>${TrackIT.esc(p.origin||'Not provided')}</strong>
            </div>
          </div>
          <div class="route-dots"><span></span><span></span><span></span></div>
          <div class="route-flow">
            <div class="route-marker end">${icon('pin')}</div>
            <div class="route-content">
              <small>To</small>
              <strong>${TrackIT.esc(p.destination||'Not provided')}</strong>
              <div class="route-address">${TrackIT.esc(p.delivery_address||'')}</div>
            </div>
          </div>
        </div>

        <div class="side-stack">
          <div class="price-box price-box-modern">
            <div class="price-top"><div class="overview-icon small">${icon('card')}</div><div><small>Shipping fee / amount</small><strong>${TrackIT.esc(p.currency||'USD')} ${TrackIT.esc(p.shipping_fee||'0.00')}</strong></div></div>
            <a class="btn btn-gold" style="width:100%" href="${mailto(p)}">Make Payment / Contact Us</a>
          </div>
          ${p.notes?`<div class="notice notice-modern"><strong>Shipment note</strong><div>${TrackIT.esc(p.notes)}</div></div>`:''}
        </div>
      </div>
    </div>
  </div>`;
  $('trackingResult').classList.add('show');
  $('trackingResult').scrollIntoView({behavior:'smooth',block:'start'});
}
async function doTrack(historyMode='push'){
  const c=$('trackingInput').value.trim();
  if(!c)return;
  const btn=$('trackBtn');
  btn.disabled=true;
  btn.textContent='Checking…';
  try{
    const p=await TrackIT.publicFind(c);
    if(p){
      render(p,historyMode);
    }else{
      $('trackingResult').innerHTML='<div class="tracking-result" style="display:block"><div style="padding:24px"><strong>Tracking number not found.</strong><p class="muted">Check the code and try again.</p></div></div>';
      $('trackingResult').classList.add('show');
    }
  }catch(e){
    $('trackingResult').innerHTML=`<div class="tracking-result" style="display:block"><div style="padding:24px"><strong>Tracking temporarily unavailable.</strong><p class="muted">${TrackIT.esc((e.message||'Please try again.').includes('schema cache')?'The tracking database is still being initialized. Please try again shortly.':(e.message||'Please try again.'))}</p></div></div>`;
    $('trackingResult').classList.add('show');
  }finally{
    btn.disabled=false;
    btn.textContent='Track Shipment';
  }
}

function codeFromLocation(){
  const match=location.pathname.match(/^\/track\/([^/]+)\/?$/i);
  if(match){
    try{return decodeURIComponent(match[1])}catch{return match[1]}
  }
  return new URLSearchParams(location.search).get('tracking');
}

$('trackBtn').onclick=()=>doTrack('push');
$('trackingInput').addEventListener('keydown',e=>{
  if(e.key==='Enter')doTrack('push');
});
$('demoBtn').onclick=()=>{
  $('trackingInput').value='TIT-DEMO-482913';
  doTrack('push');
};

const initialCode=codeFromLocation();
if(initialCode){
  $('trackingInput').value=initialCode;
  doTrack('replace');
}

window.addEventListener('popstate',()=>{
  const code=codeFromLocation();
  if(code){
    $('trackingInput').value=code;
    doTrack('none');
  }else{
    currentShipment=null;
    $('trackingInput').value='';
    $('trackingResult').innerHTML='';
    $('trackingResult').classList.remove('show');
    window.scrollTo({top:0,behavior:'smooth'});
  }
});

setInterval(()=>{
  if(currentShipment)render(currentShipment,'none');
},60000);
