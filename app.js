'use strict';
const KEY='estacion_envios_v1', $=s=>document.querySelector(s);
const fresh=()=>({version:1,riders:[],orders:[],cuts:[],theme:'dark',palette:'original',wallet:{initial:0,movements:[]}});
let db;try{db=JSON.parse(localStorage.getItem(KEY))||fresh();if(!Array.isArray(db.riders)||!Array.isArray(db.orders))throw Error('Datos inválidos')}catch{db=fresh();}
if(!Array.isArray(db.cuts))db.cuts=[];
if(!db.wallet||typeof db.wallet!=='object'||!Array.isArray(db.wallet.movements))db.wallet={initial:0,movements:[]};
if(!Number.isFinite(Number(db.wallet.initial))||Number(db.wallet.initial)<0)db.wallet.initial=0;

let selectedRider='',editOrder=null,editRider=null,orderMode='mine',walletMode='income';
const localDay=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const today=()=>localDay(new Date());
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
const hora12 = valor => {
  const m = String(valor ?? '').match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return String(valor ?? '');
  const h=Number(m[1]),min=m[2];
  if(h>23 || Number(min)>59) return String(valor);
  return String(h%12 || 12)+':'+min+(h<12?' a. m.':' p. m.');
};

const notify=t=>{const e=$('#toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),3500)};
function save(){try{localStorage.setItem(KEY,JSON.stringify(db));return true}catch{notify('Sin espacio para guardar. Exporta un respaldo; los últimos cambios no se guardaron.');return false}}
function commit(change){const old=JSON.stringify(db);change();if(!save()){db=JSON.parse(old);render();return false}render();return true}
function id(){return globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}
function startWeek(day){let d=new Date(day+'T12:00:00');d.setDate(d.getDate()-((d.getDay()+6)%7));return localDay(d)}
const periodItems=(items,day,period)=>items.filter(x=>period==='day'?x.date===day:period==='month'?x.date.slice(0,7)===day.slice(0,7):x.date>=startWeek(day)&&x.date<=localDay(new Date(new Date(startWeek(day)+'T12:00:00').getTime()+6*86400000)));
const sum=(items,field)=>items.reduce((a,x)=>a+Number(x[field]||0),0);
const scopeCuts=riderId=>db.cuts.filter(c=>(c.riderId||null)===(riderId||null));
const activeWeek=(items,day,riderId)=>{const w=periodItems(items,day,'week');const closed=new Set(scopeCuts(riderId).filter(c=>c.weekStart===startWeek(day)).flatMap(c=>c.orderIds||[]));return w.filter(o=>!closed.has(o.id))};
function renderCuts(riderId,target){const cuts=scopeCuts(riderId).slice().sort((a,b)=>b.at.localeCompare(a.at));$(target).innerHTML=cuts.length?cuts.map(c=>'<article class="cut-entry"><div><strong>'+safe(new Date(c.at).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}))+'</strong><small>Semana del '+safe(c.weekStart)+' · '+(Number(c.count)||0)+' pedidos</small></div><strong>'+money(c.total)+'</strong></article>').join(''):'<p class="cut-empty">Sin cortes manuales todavía.</p>'}
function resetWeek(riderId){const rider=riderId?db.riders.find(r=>r.id===riderId):null;if(riderId&&!rider)return;const day=today(),items=db.orders.filter(o=>(o.riderId||null)===(riderId||null)),weekly=activeWeek(items,day,riderId),total=sum(weekly,'amount')+sum(weekly,'tip');const name=rider?rider.name:'Mis ganancias';if(!confirm('¿Reiniciar semana de '+name+'?\n\nSe guardará un corte de '+money(total)+' y '+countOrders(weekly)+' pedidos. Los demás registros no se modificarán. El corte del domingo sigue igual.'))return;const cut={id:id(),riderId:riderId||null,at:new Date().toISOString(),weekStart:startWeek(day),orderIds:weekly.map(o=>o.id),total,count:countOrders(weekly)};if(commit(()=>db.cuts.push(cut)))notify('Semana reiniciada. Corte guardado.')}
const countOrders=items=>items.reduce((a,x)=>a+(Number.isInteger(Number(x.count))&&Number(x.count)>0?Number(x.count):1),0);
function cards(items,date,includeTip,riderId){let day=periodItems(items,date,'day'),week=activeWeek(items,date,riderId),month=periodItems(items,date,'month');const box=(label,value,wide=false)=>`<div class="card${wide?' wide':''}"><small>${label}</small><strong>${value}</strong></div>`;return box('Ganancia del día',money(sum(day,'amount')+sum(day,'tip')),true)+box('Pedidos del día',countOrders(day))+box('Propinas del día',includeTip?money(sum(day,'tip')):'No aplica')+box('Ganancia semanal',money(sum(week,'amount')+sum(week,'tip')))+box('Pedidos de la semana',countOrders(week))+box('Ganancia mensual',money(sum(month,'amount')+sum(month,'tip')))+box('Pedidos del mes',countOrders(month))}
function listOrders(items,container){const target=$(container);if(!items.length){target.innerHTML='<p class="empty">No hay pedidos registrados en este día.</p>';return}target.innerHTML=items.slice().sort((a,b)=>(b.date+'T'+b.time).localeCompare(a.date+'T'+a.time)).map(o=>`<article class="entry"><div><strong>${safe(o.business||'Envío')}</strong><small>${safe(o.date)} · ${safe(hora12(o.time))} · ${Number(o.count)||1} pedido${Number(o.count)===1||!o.count?'':'s'} · Envío ${money(o.amount)}${o.riderId?'':` · Propina ${money(o.tip)}`}</small></div><div><div class="price">${money(o.amount+o.tip)}</div><div class="actions"><button data-edit="${safe(o.id)}">Editar</button><button data-delete="${safe(o.id)}">Borrar</button></div></div></article>`).join('')}

/* Cartera separada de envíos y repartidores; se incluye en los respaldos de Estación Go. */
function renderWallet(){
  const w=db.wallet;
  const income=w.movements.filter(x=>x.type==='income').reduce((n,x)=>n+Number(x.amount),0);
  const expenses=w.movements.filter(x=>x.type==='expense').reduce((n,x)=>n+Number(x.amount),0);
  $('#wallet-balance').textContent=money(Number(w.initial)+income-expenses);
  $('#wallet-income').textContent=money(income);
  $('#wallet-expenses').textContent=money(expenses);
  const target=$('#wallet-movements');
  const items=w.movements.slice().sort((a,b)=>b.at.localeCompare(a.at));
  target.innerHTML=items.length?items.map(x=>{
    const ingreso=x.type==='income',amount=(ingreso?'+':'−')+money(x.amount);
    const stamp=new Date(x.at);
    const date=Number.isNaN(stamp.getTime())?'':stamp.toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'});
    return '<article class="entry wallet-entry"><div><strong>'+safe(x.description)+'</strong><small>'+safe(date)+' · '+(ingreso?'Ingreso':'Gasto')+'</small></div><div><div class="wallet-amount '+(ingreso?'wallet-positive':'wallet-negative')+'">'+amount+'</div><div class="actions"><button type="button" data-wallet-delete="'+safe(x.id)+'">Borrar</button></div></div></article>';
  }).join(''):'<p class="empty">Todavía no registras ingresos ni gastos.</p>';
}
function openWallet(mode){
  walletMode=mode;
  $('#wallet-dialog-heading').textContent=mode==='income'?'Agregar ingreso':'Registrar gasto';
  $('#wallet-description').value='';
  $('#wallet-description').placeholder=mode==='income'?'Ej. Cobro, dinero recibido':'Ej. Negrito, gasolina, comida';
  $('#wallet-amount').value='0';
  $('#wallet-dialog').showModal();
}
$('#wallet-initial').onclick=()=>{
  $('#wallet-initial-amount').value=db.wallet.initial;
  $('#wallet-initial-dialog').showModal();
};
$('#wallet-add-income').onclick=()=>openWallet('income');
$('#wallet-add-expense').onclick=()=>openWallet('expense');
$('#wallet-initial-form').addEventListener('submit',e=>{
  e.preventDefault();
  const raw=$('#wallet-initial-amount').value,amount=Number(raw);
  if(!raw||!Number.isFinite(amount)||amount<0)return notify('Ingresa un capital válido.');
  if(commit(()=>{db.wallet.initial=amount})){
    $('#wallet-initial-dialog').close();notify('Capital inicial guardado.');
  }
});
$('#wallet-form').addEventListener('submit',e=>{
  e.preventDefault();
  const description=$('#wallet-description').value.trim(),raw=$('#wallet-amount').value,amount=Number(raw);
  if(!description||!raw||!Number.isFinite(amount)||amount<=0)return notify('Escribe un concepto y una cantidad válida.');
  if(commit(()=>db.wallet.movements.push({id:id(),type:walletMode,description,amount,at:new Date().toISOString()}))){
    $('#wallet-dialog').close();notify(walletMode==='income'?'Ingreso guardado.':'Gasto guardado.');
  }
});
document.addEventListener('click',e=>{
  const del=e.target.closest('[data-wallet-delete]');
  if(!del)return;
  const movement=db.wallet.movements.find(x=>x.id===del.dataset.walletDelete);
  if(movement&&confirm('¿Eliminar el movimiento "'+movement.description+'"?')){
    if(commit(()=>{db.wallet.movements=db.wallet.movements.filter(x=>x.id!==movement.id)}))notify('Movimiento eliminado.');
  }
});

function render(){renderWallet();renderStats();document.body.classList.toggle('light',db.theme==='light');renderAppearance();const mine=db.orders.filter(x=>!x.riderId),mineDate=$('#mine-date').value||today();$('#mine-stats').innerHTML=cards(mine,mineDate,true,null);renderCuts(null,'#mine-cuts');listOrders(mine.filter(x=>x.date===mineDate),'#mine-orders');const showArchive=$('#show-archived').checked,available=db.riders.filter(x=>showArchive||!x.archived);if(!available.some(x=>x.id===selectedRider))selectedRider=available[0]?.id||'';$('#rider-select').innerHTML=available.length?available.map(r=>`<option value="${safe(r.id)}">${safe(r.name)}${r.archived?' (archivado)':''}</option>`).join(''):'<option value="">Sin repartidores</option>';$('#rider-select').value=selectedRider;let rider=db.riders.find(x=>x.id===selectedRider);$('#rider-detail').hidden=!rider;$('#rider-empty').hidden=!!rider;if(rider){$('#archive-rider').textContent=rider.archived?'Restaurar':'Archivar';$('#add-rider-order').disabled=!!rider.archived;const orders=db.orders.filter(x=>x.riderId===rider.id),dt=$('#rider-date').value||today();$('#rider-stats').innerHTML=cards(orders,dt,false,rider.id);renderCuts(rider.id,'#rider-cuts');listOrders(orders.filter(x=>x.date===dt),'#rider-orders')}}
function showView(view){$('#mine').hidden=view!=='mine';$('#riders').hidden=view!=='riders';$('#wallet').hidden=view!=='wallet';$('#stats').hidden=view!=='stats';document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('selected',x.dataset.view===view));render()}
function openOrder(mode,order=null){orderMode=mode;editOrder=order?.id||null;$('#order-heading').textContent=order?'Editar envío':'Nuevo envío';$('#order-business').value=order?.business||'';$('#order-amount').value=order?.amount??'0';$('#order-tip').value=order?.tip??'0';$('#order-date').value=order?.date||today();$('#order-count').value=order?.count||1;$('#tip-field').hidden=mode!=='mine';preview();$('#order-dialog').showModal()}
function preview(){let amount=Number($('#order-amount').value)||0,tip=orderMode==='mine'?Number($('#order-tip').value)||0:0;const count=Number($('#order-count').value)||1;$('#order-preview').textContent='Total del viaje: '+money(amount+tip)+' · '+count+' pedido'+(count===1?'':'s')}
$('#order-form').addEventListener('submit',e=>{e.preventDefault();const amount=Number($('#order-amount').value),tip=orderMode==='mine'?Number($('#order-tip').value||0):0,count=Number($('#order-count').value),date=$('#order-date').value,time=editOrder?(db.orders.find(x=>x.id===editOrder)?.time||new Date().toTimeString().slice(0,5)):new Date().toTimeString().slice(0,5);if(!Number.isFinite(amount)||!Number.isFinite(tip)||amount<0||tip<0||!Number.isInteger(count)||count<1||count>100||!date||!time)return notify('Revisa los montos y la fecha.');let rid=orderMode==='mine'?null:selectedRider;if(orderMode==='rider'&&!db.riders.some(x=>x.id===rid&&!x.archived))return notify('Selecciona un repartidor activo');let record={id:editOrder||id(),riderId:rid,amount,tip,count,business:$('#order-business').value.trim(),date,time};if(commit(()=>{if(editOrder){const idx=db.orders.findIndex(x=>x.id===editOrder);if(idx>=0){record.riderId=db.orders[idx].riderId;db.orders[idx]=record}}else db.orders.push(record)})){$('#order-dialog').close();notify('Envío guardado')}});
$('#order-amount').addEventListener('input',preview);$('#order-tip').addEventListener('input',preview);$('#order-count').addEventListener('input',preview);
function openRider(rider=null){editRider=rider?.id||null;$('#rider-heading').textContent=rider?'Editar repartidor':'Agregar repartidor';$('#rider-name').value=rider?.name||'';$('#rider-dialog').showModal()}
$('#rider-form').addEventListener('submit',e=>{e.preventDefault();let name=$('#rider-name').value.trim();if(!name)return;const newId=editRider||id();if(commit(()=>{if(editRider){const r=db.riders.find(x=>x.id===editRider);if(r)r.name=name}else db.riders.push({id:newId,name,archived:false})})){selectedRider=newId;$('#rider-dialog').close();render();notify('Repartidor guardado')}});
$('#reset-mine-week').onclick=()=>resetWeek(null);$('#reset-rider-week').onclick=()=>resetWeek(selectedRider);
$('#add-mine').onclick=()=>openOrder('mine');$('#add-rider').onclick=()=>openRider();$('#add-rider-order').onclick=()=>openOrder('rider');$('#rename-rider').onclick=()=>openRider(db.riders.find(x=>x.id===selectedRider));
$('#archive-rider').onclick=()=>{const r=db.riders.find(x=>x.id===selectedRider);if(!r)return;const archived=!r.archived;if(!confirm(archived?`¿Archivar a ${r.name}? Sus pedidos se conservarán.`:`¿Restaurar a ${r.name}?`))return;commit(()=>{r.archived=archived});notify(archived?'Repartidor archivado':'Repartidor restaurado')};
$('#delete-rider').onclick=()=>{let r=db.riders.find(x=>x.id===selectedRider);if(!r||!confirm(`¿Eliminar permanentemente a ${r.name} y TODOS sus pedidos? Esta acción no se puede deshacer.`))return;commit(()=>{db.riders=db.riders.filter(x=>x.id!==r.id);db.orders=db.orders.filter(x=>x.riderId!==r.id);db.cuts=db.cuts.filter(c=>c.riderId!==r.id)});notify('Repartidor e historial eliminados')};
$('#rider-select').onchange=e=>{selectedRider=e.target.value;render()};$('#show-archived').onchange=render;
for(const key of ['mine','rider']){$('#'+key+'-date').value=today();$('#'+key+'-date').addEventListener('change',render);$('#'+key+'-today').onclick=()=>{$('#'+key+'-date').value=today();render()}}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.addEventListener('click',e=>{const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');if(edit){let o=db.orders.find(x=>x.id===edit.dataset.edit);if(o)openOrder(o.riderId?'rider':'mine',o)}if(del){let o=db.orders.find(x=>x.id===del.dataset.delete);if(o&&confirm('¿Eliminar este pedido definitivamente?'))commit(()=>db.orders=db.orders.filter(x=>x.id!==o.id))}});
const palettes=[['original','Original','#22c55e'],['blue','Azul','#3b82f6'],['purple','Morado','#a855f7'],['red','Rojo','#ef4444'],['orange','Naranja','#f97316'],['pink','Rosa','#ec4899'],['teal','Turquesa','#14b8a6']];
function renderAppearance(){
  const palette=palettes.some(x=>x[0]===db.palette)?db.palette:'original';
  document.body.dataset.palette=palette;
  document.querySelectorAll('[data-theme-choice]').forEach(b=>{const active=b.dataset.themeChoice===db.theme;b.classList.toggle('active-choice',active);b.setAttribute('aria-pressed',String(active))});
  $('#palette-options').innerHTML=palettes.map(([key,name,color])=>'<button type="button" class="palette-option'+(key===palette?' active-choice':'')+'" data-palette="'+key+'" aria-pressed="'+(key===palette)+'"><span class="palette-dot" style="background:'+color+'"></span><span>'+name+'</span></button>').join('');
}
$('#settings-open').onclick=()=>$('#settings-dialog').showModal();
$('#settings-close').onclick=()=>$('#settings-dialog').close();
document.querySelectorAll('[data-theme-choice]').forEach(b=>b.onclick=()=>commit(()=>{db.theme=b.dataset.themeChoice}));
$('#palette-options').addEventListener('click',e=>{const b=e.target.closest('[data-palette]');if(b&&palettes.some(x=>x[0]===b.dataset.palette))commit(()=>{db.palette=b.dataset.palette})});
$('#export').onclick=()=>{const file=new Blob([JSON.stringify({...db,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}),url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download='estacion-envios-respaldo-'+today()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)};
$('#import').onclick=()=>$('#import-file').click();$('#import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const d=JSON.parse(await file.text());if(d.version!==1||!Array.isArray(d.riders)||!Array.isArray(d.orders)||d.orders.some(o=>typeof o.id!=='string'||typeof o.amount!=='number'||!Number.isFinite(o.amount)||typeof o.date!=='string'||!/^\d{4}-\d\d-\d\d$/.test(o.date))||d.riders.some(r=>typeof r.id!=='string'||typeof r.name!=='string'))throw Error('Formato incorrecto');if(!confirm('Importar reemplazará TODOS los datos actuales de esta aplicación. ¿Continuar?'))return;commit(()=>{db={version:1,riders:d.riders,orders:d.orders,cuts:Array.isArray(d.cuts)?d.cuts:[],theme:d.theme==='light'?'light':'dark',palette:palettes.some(x=>x[0]===d.palette)?d.palette:'original',wallet:d.wallet&&Number.isFinite(Number(d.wallet.initial))&&Number(d.wallet.initial)>=0&&Array.isArray(d.wallet.movements)&&d.wallet.movements.every(x=>x&&typeof x.id==='string'&&typeof x.description==='string'&&['income','expense'].includes(x.type)&&typeof x.amount==='number'&&Number.isFinite(x.amount)&&x.amount>0&&typeof x.at==='string')?{initial:Number(d.wallet.initial),movements:d.wallet.movements}:{initial:0,movements:[]}}});notify('Respaldo importado')}catch{notify('No se pudo importar el archivo. Revisa que sea un respaldo válido.')}finally{e.target.value=''}};

// Facilita escribir cantidades en iPhone: el cero inicial desaparece al tocar
// el campo, sin tener que seleccionarlo ni borrarlo a mano.
document.addEventListener('focusin',e=>{
  const field=e.target;
  if(field instanceof HTMLInputElement&&field.type==='number'&&Number(field.value)===0&&field.value.trim()!==''){
    field.value='';
  }
});
document.addEventListener('focusout',e=>{
  const field=e.target;
  if(field instanceof HTMLInputElement&&field.type==='number'&&field.value.trim()===''){
    field.value='0';
  }
});


/* Estadísticas: lectura de pedidos existentes; no modifica registros ni cortes. */
const statsName=value=>String(value||'').trim().replace(/\s+/g,' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-MX');
function renderStats(){
  const scope=$('#stats-scope').value,period=$('#stats-period').value,day=today();
  const orders=db.orders.filter(o=>(scope==='all'||(scope==='mine'?!o.riderId:!!o.riderId))&&(period==='all'||periodItems([o],day,period).length));
  const groups=new Map();
  for(const o of orders){
    const name=String(o.business||'').trim().replace(/\s+/g,' ')||'Sin restaurante';
    const key=statsName(name);
    if(!groups.has(key))groups.set(key,{name,count:0,amount:0,tip:0});
    const g=groups.get(key);g.count+=Number.isInteger(Number(o.count))&&Number(o.count)>0?Number(o.count):1;
    g.amount+=Number(o.amount)||0;g.tip+=Number(o.tip)||0;
  }
  const ranking=[...groups.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'es'));
  const total=countOrders(orders),amount=sum(orders,'amount'),tip=sum(orders,'tip');
  const card=(label,value)=>'<div class="card"><small>'+label+'</small><strong>'+value+'</strong></div>';
  $('#stats-summary').innerHTML=card('Pedidos',total)+card('Envíos',money(amount))+card('Propinas',money(tip))+card('Total',money(amount+tip));
  const max=ranking[0]?.count||1;
  $('#stats-ranking').innerHTML=ranking.length?ranking.map((g,i)=>'<article class="stats-rank"><div class="stats-rank-line"><strong>'+(i===0?'🏆 ':'')+(i+1)+'. '+safe(g.name)+'</strong><span>'+g.count+' pedidos · '+(total?(g.count/total*100).toFixed(1):'0')+'%</span></div><div class="stats-track"><div style="width:'+(g.count/max*100)+'%"></div></div></article>').join(''):'<p class="empty">Todavía no hay pedidos en este periodo.</p>';
  $('#stats-detail').innerHTML=ranking.length?'<div class="stats-table-wrap"><table class="stats-table"><thead><tr><th>Restaurante</th><th>Pedidos</th><th>Envíos</th><th>Propinas</th><th>Total</th></tr></thead><tbody>'+ranking.map(g=>'<tr><td>'+safe(g.name)+'</td><td>'+g.count+'</td><td>'+money(g.amount)+'</td><td>'+money(g.tip)+'</td><td>'+money(g.amount+g.tip)+'</td></tr>').join('')+'</tbody></table></div>':'';
}
$('#stats-scope').addEventListener('change',renderStats);
$('#stats-period').addEventListener('change',renderStats);

render();if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
