// config di base (modifica come preferisci)
const CONFIG = {
  startHour: 9,      // orario di apertura (ore, 24h)
  endHour: 18,       // orario di chiusura
  slotMinutes: 30,   // dimensione slot (30 min)
  break: [],         // array di oggetti {date:"2025-09-20", from:"12:00", to:"13:00"} per ferie/pausa
  adminPassword: "admin123" // cambia per sicurezza se usi admin semplice
};

document.getElementById('year').textContent = new Date().getFullYear();

// utility
function toTimeStr(d){
  return d.toTimeString().slice(0,5);
}
function pad(n){return n<10? '0'+n : ''+n}

// genera array di slot tra start e end per una data
function generateSlots(dateStr){
  const date = new Date(dateStr + 'T00:00:00');
  const slots = [];
  for(let h=CONFIG.startHour; h<CONFIG.endHour; h++){
    for(let m=0; m<60; m+=CONFIG.slotMinutes){
      const dt = new Date(date);
      dt.setHours(h, m, 0, 0);
      slots.push({time: toTimeStr(dt), iso: dt.toISOString()});
    }
  }
  // rimuovi slot in break (semplice)
  return slots;
}

// storage
function loadBookings(){
  return JSON.parse(localStorage.getItem('bookings_v1') || '[]');
}
function saveBooking(b){
  const arr = loadBookings();
  arr.push(b);
  localStorage.setItem('bookings_v1', JSON.stringify(arr));
}

// verifica sovrapposizione
function slotIsFree(dateStr, timeStr, duration){
  const start = new Date(dateStr + 'T' + timeStr + ':00');
  const end = new Date(start.getTime() + duration*60000);
  return !loadBookings().some(b => {
    const bs = new Date(b.date + 'T' + b.time + ':00');
    const be = new Date(bs.getTime() + b.duration*60000);
    return (start < be && end > bs);
  });
}

// mostra orari disponibili
function renderTimes(){
  const dateInput = document.getElementById('date');
  const date = dateInput.value;
  const timesDiv = document.getElementById('times');
  timesDiv.innerHTML = '';
  if(!date) return;
  const serviceSel = document.getElementById('service');
  const duration = Number(serviceSel.selectedOptions[0].dataset.duration);
  const slots = generateSlots(date);
  slots.forEach(s=>{
    const free = slotIsFree(date, s.time, duration);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'time-slot'+(free ? '' : ' booked');
    btn.textContent = s.time;
    if(!free) btn.disabled = true;
    btn.addEventListener('click', ()=> {
      // seleziona orario (e evidenzia)
      document.querySelectorAll('.time-slot.selected').forEach(el=>el.classList.remove('selected'));
      btn.classList.add('selected');
    });
    timesDiv.appendChild(btn);
  });
}

// crea file .ics per calendario
function createICS(booking){
  const padn = n => n<10?'0'+n:n;
  const dt = new Date(booking.date + 'T' + booking.time + ':00');
  const dtEnd = new Date(dt.getTime() + booking.duration*60000);
  const formatDate = d => d.getUTCFullYear()+padn(d.getUTCMonth()+1)+padn(d.getUTCDate())+'T'+padn(d.getUTCHours())+padn(d.getUTCMinutes())+'00Z';
  const uid = 'booking-'+Date.now()+'@fisioterapista.local';
  const ics =
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Fisioterapista//Prenotazioni//IT
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(dt)}
DTEND:${formatDate(dtEnd)}
SUMMARY:${booking.service} - ${booking.name}
DESCRIPTION:Prenotazione con ${booking.name}. Tel:${booking.phone}
LOCATION:Studio di ${booking.clinic || 'Via Esempio 12, Milano'}
END:VEVENT
END:VCALENDAR`;
  return new Blob([ics], {type:'text/calendar'});
}

// gestione prenotazione
document.getElementById('date').addEventListener('change', renderTimes);
document.getElementById('service').addEventListener('change', renderTimes);

document.getElementById('bookBtn').addEventListener('click', ()=>{
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const date = document.getElementById('date').value;
  const serviceSel = document.getElementById('service');
  const service = serviceSel.value;
  const duration = Number(serviceSel.selectedOptions[0].dataset.duration);
  const selected = document.querySelector('.time-slot.selected');
  const msg = document.getElementById('bookingMessage');
  msg.innerHTML = '';
  if(!name || !email || !phone || !date || !selected){
    msg.textContent = 'Compila tutti i campi e scegli un orario.';
    return;
  }
  const time = selected.textContent;
  if(!slotIsFree(date, time, duration)){
    msg.textContent = 'Spiacente, lo slot è già stato occupato. Ricarica la pagina e riprova.';
    renderTimes();
    return;
  }
  const booking = {name,email,phone,date,time,service,duration,created: new Date().toISOString()};
  saveBooking(booking);
  msg.innerHTML = Prenotazione confermata per <strong>${date} ${time}</strong> — ${service}. <br>Ti è stato scaricato un file .ics per aggiungere l'appuntamento al tuo calendario.;
  // scarica .ics
  const blob = createICS(booking);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = prenotazione-${date}-${time}.ics;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  // pulizia UI
  document.querySelectorAll('.time-slot.selected').forEach(el=>el.classList.remove('selected'));
  renderTimes();
});

// admin view (molto semplice)
document.getElementById('adminBtn').addEventListener('click', ()=>{
  const p = document.getElementById('adminPass').value;
  const listDiv = document.getElementById('adminList');
  listDiv.innerHTML = '';
  if(p !== CONFIG.adminPassword){
    listDiv.textContent = 'Password errata.';
    return;
  }
  const arr = loadBookings().sort((a,b)=> new Date(a.date+'T'+a.time) - new Date(b.date+'T'+b.time));
  if(arr.length===0){ listDiv.textContent = 'Nessuna prenotazione'; return; }
  arr.forEach(b=>{
    const el = document.createElement('div');
    el.style.padding='8px';
    el.style.borderBottom='1px solid #eee';
    el.innerHTML = <strong>${b.date} ${b.time}</strong> — ${b.service}<br>${b.name} | ${b.phone} | ${b.email};
    listDiv.appendChild(el);
  });
});

// inizializzazione: imposta oggi come minimo e selezione data iniziale
(function init(){
  const dateInput = document.getElementById('date');
  const today = new Date();
  const min = today.toISOString().slice(0,10);
  dateInput.min = min;
  // default: giorno dopo
  const tomorrow = new Date(today.getTime() + 24*3600*1000);
  dateInput.value = tomorrow.toISOString().slice(0,10);
  renderTimes();
})();