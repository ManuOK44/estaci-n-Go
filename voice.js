'use strict';
(()=>{
const btn=document.querySelector('#voice-order'),box=document.querySelector('#voice-panel');
if(!btn||!box)return;
const Rec=window.SpeechRecognition||window.webkitSpeechRecognition;
const input=box.querySelector('#voice-text'),status=box.querySelector('#voice-status'),start=box.querySelector('#voice-listen'),parseBtn=box.querySelector('#voice-parse'),confirmBtn=box.querySelector('#voice-confirm'),cancelBtn=box.querySelector('#voice-cancel'),summary=box.querySelector('#voice-summary');
let candidate=null,recognition=null,listening=false;
const numberWords={'cero':0,'un':1,'uno':1,'una':1,'dos':2,'tres':3,'cuatro':4,'cinco':5,'seis':6,'siete':7,'ocho':8,'nueve':9,'diez':10,'once':11,'doce':12,'trece':13,'catorce':14,'quince':15,'dieciseis':16,'dieciséis':16,'diecisiete':17,'dieciocho':18,'diecinueve':19,'veinte':20,'veintiuno':21,'veintidos':22,'veintidós':22,'veintitres':23,'veintitrés':23,'veinticuatro':24,'veinticinco':25,'veintiseis':26,'veintiséis':26,'veintisiete':27,'veintiocho':28,'veintinueve':29,'treinta':30,'cuarenta':40,'cincuenta':50,'sesenta':60,'setenta':70,'ochenta':80,'noventa':90,'cien':100,'ciento':100,'doscientos':200,'trescientos':300,'cuatrocientos':400,'quinientos':500};
const numToken='(?:\\d+(?:[.,]\\d{1,2})?|[a-záéíóúñ]+(?:\\s+y\\s+[a-záéíóúñ]+)?)';
function amount(s){s=(s||'').toLowerCase().trim();if(/^\\d/.test(s))return Number(s.replace(',','.'));let parts=s.split(/\\s+y\\s+/);if(parts.length===2&&parts.every(x=>numberWords[x]!=null))return numberWords[parts[0]]+numberWords[parts[1]];return numberWords[s]??NaN}
function extract(label,t){const re=new RegExp('(?:'+label+')\\s*(?:de|por|son|fue|fueron|\\$)?\\s*('+numToken+')','i');let m=t.match(re);return m?amount(m[1]):NaN}
function moneyVoice(n){return Number(n).toLocaleString('es-MX',{style:'currency',currency:'MXN'})}
function parse(t){
 t=t.toLowerCase().replace(/[,:;]/g,' ').replace(/pesos?|mxn/gi,' ').replace(/\\s+/g,' ').trim();
 const tipPending=/propina\\s+(?:pendiente|despu[eé]s|todav[ií]a no|no s[eé])/.test(t);
 const tip=extract('propina',t),delivery=extract('(?:env[ií]o|reparto|servicio)',t);
 const pendingUpdate=/^(?:agregar|actualizar|completar|poner|registrar)\\s+(?:la\\s+)?propina/.test(t)||(!/env[ií]o/.test(t)&&Number.isFinite(tip)&&!/^pedido\\b/.test(t));
 if(pendingUpdate){return Number.isFinite(tip)?{kind:'tip',tip}:null}
 if(!Number.isFinite(delivery)||(!Number.isFinite(tip)&&!tipPending))return null;
 let business=(t.match(/(?:pedido|negocio|de)\\s+(.+?)(?=\\s+(?:\\d|env[ií]o|propina|con|y\\s+\\d)|$)/)||[])[1]||'';
 business=business.replace(/^(?:del|de|la|el)\\s+/,'').trim();
 if(!business){business=(t.match(/^(.+?)\\s+(?:(?:\\d+|[a-záéíóúñ]+)\\s+de\\s+)?(?:env[ií]o|propina)/)||[])[1]||''}
 return {kind:'order',business:business.trim().slice(0,100),amount:delivery,tip:Number.isFinite(tip)?tip:0,pending:tipPending};
}
function clear(){candidate=null;confirmBtn.hidden=true;summary.textContent='';}
function interpret(){clear();candidate=parse(input.value);if(!candidate){status.textContent='No pude distinguir el envío y la propina. Prueba: “Pedido Taconazo, 25 de envío, 70 de propina”.';return}
 if(candidate.kind==='tip'){
 const pending=db.orders.filter(o=>!o.riderId&&o.tipPending).sort((a,b)=>(b.date+'T'+b.time).localeCompare(a.date+'T'+a.time));
 if(!pending.length){candidate=null;status.textContent='No tienes pedidos con propina pendiente.';return}
 candidate.orderId=pending[0].id;
 summary.textContent='Completar propina del último pendiente: '+(pending[0].business||'Envío')+', '+moneyVoice(candidate.tip)+'.';
 } else {summary.textContent=(candidate.business||'Sin negocio')+' · Envío '+moneyVoice(candidate.amount)+' · '+(candidate.pending?'Propina pendiente':'Propina '+moneyVoice(candidate.tip))+' · Total actual '+moneyVoice(candidate.amount+candidate.tip);}
 status.textContent='Revisa los datos antes de guardarlos.';confirmBtn.hidden=false;
}
btn.onclick=()=>{box.hidden=!box.hidden;if(!box.hidden){clear();status.textContent='Habla o dicta el pedido. Se guardará solo al pulsar Confirmar.';input.focus()}};
cancelBtn.onclick=()=>{box.hidden=true;clear();if(listening&&recognition)recognition.stop()};
parseBtn.onclick=interpret;
confirmBtn.onclick=()=>{
 if(!candidate)return;
 const c=candidate;
 if(c.kind==='tip'){
 const o=db.orders.find(o=>o.id===c.orderId&&o.tipPending&&!o.riderId);
 if(!o){status.textContent='Ya no existe ese pedido pendiente.';clear();return}
 if(commit(()=>{o.tip=c.tip;o.tipPending=false})){notify('Propina completada');box.hidden=true;input.value='';clear()}
 }else{
 if(!Number.isFinite(c.amount)||c.amount<0||!Number.isFinite(c.tip)||c.tip<0){status.textContent='Importes incorrectos.';return}
 const now=new Date(),record={id:id(),riderId:null,amount:c.amount,tip:c.tip,tipPending:c.pending,count:1,business:c.business,date:today(),time:now.toTimeString().slice(0,5)};
 if(commit(()=>db.orders.push(record))){notify('Envío por voz guardado');box.hidden=true;input.value='';clear()}
 }
};
if(!Rec){start.hidden=true;status.textContent='Tu navegador no permite escuchar desde este botón. Puedes usar el micrófono del teclado del iPhone en el cuadro de texto.'}
else{start.onclick=()=>{
 if(listening){recognition.stop();return}
 try{recognition=new Rec();recognition.lang='es-MX';recognition.interimResults=false;recognition.maxAlternatives=1;
 recognition.onresult=e=>{input.value=e.results[0][0].transcript;interpret()};
 recognition.onerror=e=>{status.textContent='No se pudo reconocer la voz ('+e.error+'). Usa el dictado del teclado si lo prefieres.'};
 recognition.onend=()=>{listening=false;start.textContent='🎙 Escuchar pedido'};
 recognition.start();listening=true;start.textContent='■ Detener';status.textContent='Escuchando...';
 }catch{status.textContent='No se pudo activar el micrófono. Usa el dictado del teclado.'}
 }}
})();
