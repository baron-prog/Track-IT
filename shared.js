(function(){
  const cfg=window.TRACKIT_CONFIG||{};
  const configured=cfg.supabaseUrl&&cfg.supabaseAnonKey&&!cfg.supabaseUrl.startsWith('PASTE_')&&!cfg.supabaseAnonKey.startsWith('PASTE_');
  let client=null;
  if(configured&&window.supabase) client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
  const LOCAL_KEY='trackit_cloud_v3_local_shipments';
  function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function today(){const d=new Date();d.setHours(0,0,0,0);return d}
  function passed(v){if(!v)return false;const d=new Date(v+'T00:00:00');return d<=today()}
  function fmt(v){if(!v)return'Not scheduled';const d=new Date(v+'T12:00:00');return isNaN(d)?v:d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}
  function milestones(p){return[['received_date','Package received',p.origin||'Origin facility'],['in_transit_date','In transit',p.transit_hub||'Moving through our network'],['customs_date','Customs / clearance',p.customs_location||'International clearance'],['out_for_delivery_date','Out for delivery',p.delivery_city||p.destination||'Destination area'],['delivery_date','Final delivery',p.delivery_address||p.destination||'Recipient address']]}
  function status(p){if(p.manual_status&&p.manual_status!=='Auto')return p.manual_status;let s='Shipment information received';for(const [k,l] of milestones(p))if(passed(p[k]))s=l;return passed(p.delivery_date)?'Delivered':s}
  function checkpoint(p){let out=p.origin||'Origin facility';for(const [k,l,d] of milestones(p))if(passed(p[k]))out=d;return out}
  function genCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<8;i++)s+=chars[Math.floor(Math.random()*chars.length)];return `TIT-${new Date().getFullYear()}-${s}`}
  function readLocal(){try{return JSON.parse(localStorage.getItem(LOCAL_KEY)||'[]')}catch{return[]}}
  function writeLocal(v){localStorage.setItem(LOCAL_KEY,JSON.stringify(v))}
  function seedLocal(){if(readLocal().length)return;const add=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};writeLocal([{id:'demo',tracking_code:'TIT-DEMO-482913',sender_name:'Demo Sender',recipient_name:'Alex Morgan',origin:'Lagos, Nigeria',destination:'London, United Kingdom',delivery_address:'14 Example Street, London',package_type:'Priority parcel',weight:'3.4 kg',declared_value:'950',shipping_fee:'185.00',currency:'USD',transit_hub:'International Transit Hub',customs_location:'London Clearance Facility',delivery_city:'London',received_date:add(-1),in_transit_date:add(0),customs_date:add(1),out_for_delivery_date:add(2),delivery_date:add(3),manual_status:'Auto',notes:'Signature may be required at delivery.'}])}
  async function publicFind(code){if(client){const {data,error}=await client.rpc('get_shipment_by_tracking',{p_code:code.trim()});if(error)throw error;return data&&data[0]?data[0]:null}seedLocal();return readLocal().find(p=>p.tracking_code.toLowerCase()===code.trim().toLowerCase())||null}
  async function adminList(){if(client){const {data,error}=await client.from('shipments').select('*').order('created_at',{ascending:false});if(error)throw error;return data||[]}seedLocal();return readLocal()}
  async function adminUpsert(p){if(client){const {data,error}=await client.from('shipments').upsert(p,{onConflict:'tracking_code'}).select().single();if(error)throw error;return data}seedLocal();let a=readLocal();const i=a.findIndex(x=>x.tracking_code===p.tracking_code);if(i>=0)a[i]={...a[i],...p};else a.unshift({...p,id:crypto.randomUUID?crypto.randomUUID():String(Date.now())});writeLocal(a);return p}
  async function adminDelete(code){if(client){const {error}=await client.from('shipments').delete().eq('tracking_code',code);if(error)throw error;return}writeLocal(readLocal().filter(x=>x.tracking_code!==code))}
  window.TrackIT={cfg,configured,client,esc,fmt,passed,milestones,status,checkpoint,genCode,publicFind,adminList,adminUpsert,adminDelete};
})();
