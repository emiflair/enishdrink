// cSpell: disable
// Offers Modal + Trigger Button Script
// Replaces banner: displays a "See Offers" floating button; on click opens modal with today's offer and weekly list.
(function(){
  const OFFERS_JSON = 'offers.json';
  const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  let offersCache = null;

  function el(tag, cls, text){
    const e = document.createElement(tag);
    if(cls) e.className = cls;
    if(text) e.textContent = text;
    return e;
  }

  async function loadOffers(){
    if(offersCache) return offersCache;
    try {
      const r = await fetch(OFFERS_JSON,{cache:'no-store'});
      if(!r.ok) throw new Error('fetch failed');
      offersCache = await r.json();
    } catch(err){
      console.warn('[OFFERS] load error', err);
      offersCache = {};
    }
    return offersCache;
  }

  // Determine the current 'offer day' based on Dubai time (UTC+4) with a 4:00 AM cutoff.
  // Between 00:00 and 03:59 Dubai time we still show the previous day's offers.
  function todayKey(){
    try {
      const now = new Date();
      const dtf = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dubai', weekday: 'short', hour: 'numeric', hour12: false });
      const parts = dtf.formatToParts(now);
      const weekdayPart = parts.find(p => p.type === 'weekday');
      const hourPart = parts.find(p => p.type === 'hour');
      if(!weekdayPart || !hourPart) throw new Error('format parts missing');
      const weekdayShort = weekdayPart.value; // Sun, Mon, Tue, ...
      const hour = parseInt(hourPart.value, 10);
      const map = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
      let idx = map[weekdayShort];
      if(typeof idx !== 'number') throw new Error('weekday map failed');
      // Apply 4am cutoff: before 4 => previous day
      if(hour < 4) idx = (idx + 6) % 7; // wrap to previous day
      return String(idx);
    } catch(err){
      console.warn('[OFFERS] Dubai day calc failed, fallback to local', err);
      // Fallback: local day
      const localDay = new Date().getDay();
      return String(localDay);
    }
  }

  function buildModal(offers){
    const existing = document.querySelector('.offers-modal-wrapper');
    if(existing) existing.remove();
    const wrap = el('div','offers-modal-wrapper');
    wrap.setAttribute('role','dialog');
    wrap.setAttribute('aria-modal','true');
    wrap.setAttribute('aria-label','Weekly Offers');
    const overlay = el('div','offers-overlay');
    const panel = el('div','offers-panel');
    const header = el('div','offers-header');
    const title = el('h2','offers-heading','This Week at Enish');
    const close = el('button','offers-close','×');
    close.setAttribute('aria-label','Close offers');
    close.addEventListener('click', () => dismissModal(wrap));
    header.appendChild(title);
    header.appendChild(close);

    const body = el('div','offers-body');
    const today = todayKey();

  // Today highlight
    const todayBox = el('div','offer-today-box offer-today-highlight');
    const todayOffer = offers[today];
    const todayDayName = DAY_NAMES[parseInt(today,10)];
  // Build a head row so the badge doesn't overlap content.
  const head = el('div','offer-today-head');
  const badge = el('div','offer-today-badge','TODAY');
  const todayTitle = el('div','offer-today-title', todayOffer ? (todayOffer.title || todayDayName) : ('Today: '+ todayDayName));
  todayTitle.setAttribute('tabindex','-1');
  head.appendChild(badge);
  head.appendChild(todayTitle);
  todayBox.appendChild(head);
    if(todayOffer && Array.isArray(todayOffer.lines)){
      const ul = el('ul','offer-lines');
      todayOffer.lines.forEach(l => {
        const li = el('li','', l);
        ul.appendChild(li);
      });
      todayBox.appendChild(ul);
    } else {
      todayBox.appendChild(el('div','offer-empty','No special offer listed for today.'));
    }
    // Countdown to next rollover (4 AM Dubai)
    const countdown = el('div','offer-countdown','');
    todayBox.appendChild(countdown);
    startCountdown(countdown);
    // Happy Hour button for today
    todayBox.appendChild(makeHappyHourButton());
    body.appendChild(todayBox);

    // Weekly list
    const weekWrap = el('div','offers-week');
    Object.keys(offers).sort((a,b)=> parseInt(a,10)-parseInt(b,10)).forEach(k => {
      const box = el('div','offer-day-box'+(k===today?' is-today':''));
      const dTitle = el('div','offer-day-title', offers[k].title || DAY_NAMES[parseInt(k,10)]);
      box.appendChild(dTitle);
      const mini = el('ul','offer-mini-lines');
      (offers[k].lines||[]).slice(0,3).forEach(l=> mini.appendChild(el('li','', l)));
      box.appendChild(mini);
      box.appendChild(makeHappyHourButton());
      weekWrap.appendChild(box);
    });
    body.appendChild(weekWrap);

    // Happy Hour hidden panel appended after week list
    const hhPanel = buildHappyHourPanel();
    body.appendChild(hhPanel);

    panel.appendChild(header);
    panel.appendChild(body);
    wrap.appendChild(overlay);
    wrap.appendChild(panel);

    overlay.addEventListener('click', () => dismissModal(wrap));
    document.addEventListener('keydown', escListener);
    function escListener(e){ if(e.key==='Escape'){ dismissModal(wrap); } }
    panel.addEventListener('transitionend', () => { if(!document.body.contains(wrap)) document.removeEventListener('keydown', escListener); });

    document.body.appendChild(wrap);
    requestAnimationFrame(()=> {
      wrap.classList.add('open');
      // After animation frame, focus today's title for visibility / accessibility.
      setTimeout(()=> { try { todayTitle.focus({preventScroll:false}); } catch(_){} }, 60);
    });
  }

  function dismissModal(wrap){
    wrap.classList.remove('open');
    setTimeout(()=> wrap.remove(), 250);
  }

  function ensureTrigger(){
    if(document.querySelector('.offers-trigger')) return;
    const btn = el('button','offers-trigger','See Offers');
    btn.type = 'button';
    btn.addEventListener('click', async () => {
      const offers = await loadOffers();
      buildModal(offers);
    });
    document.body.appendChild(btn);
  }

  function init(){ ensureTrigger(); }

  /* ===== Scroll Reveal for Menu Items ===== */
  function initReveal(){
    const items = document.querySelectorAll('.menu-section .menu-item, .spirits-item, .wine-item, .beer-item, .misc-item');
    items.forEach(it=> it.classList.add('reveal'));
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if(entry.isIntersecting){ entry.target.classList.add('in'); obs.unobserve(entry.target);} 
      });
    }, { threshold:0.12 });
    items.forEach(it=> obs.observe(it));
  }

  /* ===== Countdown Logic (Dubai time with 4 AM rollover) ===== */
  function msUntilNextRollover(){
    try {
      const now = new Date();
      // Convert now to Dubai by using its components via Intl (approx w/out external libs)
      const fmt = new Intl.DateTimeFormat('en-US',{ timeZone:'Asia/Dubai', hour12:false, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit'});
      const parts = Object.fromEntries(fmt.formatToParts(now).map(p=>[p.type,p.value]));
      const y = parseInt(parts.year,10); const m = parseInt(parts.month,10); const d = parseInt(parts.day,10); let h = parseInt(parts.hour,10); const min = parseInt(parts.minute,10); const s = parseInt(parts.second,10);
      // Determine Dubai local date at next 4AM boundary
      // If current hour >=4 => next is tomorrow 4AM, else today 4AM
      let targetDay = d, targetMonth=m, targetYear=y;
      if(h >= 4) {
        // Move to tomorrow
        const tmp = new Date(Date.UTC(y, m-1, d, h, min, s));
        tmp.setUTCDate(tmp.getUTCDate()+1);
        targetYear = tmp.getUTCFullYear(); targetMonth = tmp.getUTCMonth()+1; targetDay = tmp.getUTCDate();
      }
      const targetDubai = new Date(Date.UTC(targetYear, targetMonth-1, targetDay, 4, 0, 0));
      // Approx difference between Dubai and UTC now by comparing offset at now
      const nowUTCms = now.getTime();
      // Convert current Dubai date-time back to UTC milliseconds for difference
      // We'll get an approximate by constructing Date assuming UTC then adjusting by guessed offset from components we parsed.
      // Instead simpler: compute Dubai current timestamp by building Date.UTC from components and then subtract difference to now
      const dubaiCurrent = Date.UTC(y, m-1, d, h, min, s);
      const offsetGuess = dubaiCurrent - nowUTCms; // positive ~ (UTC+4)*3600*1000
      const targetUTCms = targetDubai - offsetGuess; // remove offset to approximate UTC ms of that Dubai boundary
      return Math.max(0, targetUTCms - nowUTCms);
    } catch(err){ return 0; }
  }

  function formatDuration(ms){
    const totalSec = Math.floor(ms/1000);
    const hrs = Math.floor(totalSec/3600);
    const mins = Math.floor((totalSec%3600)/60);
    const secs = totalSec%60;
    return `${hrs.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
  }

  function startCountdown(elm){
    function tick(){
      const remain = msUntilNextRollover();
      if(remain <= 0){ elm.textContent = 'Updating...'; setTimeout(()=>{ location.reload(); }, 1500); return; }
      elm.textContent = 'Next offer refresh in ' + formatDuration(remain);
      requestAnimationFrame(()=> setTimeout(tick, 1000));
    }
    tick();
  }

  /* ===== Happy Hour Feature ===== */
  const HAPPY_HOUR = {
    title: 'HALF THE PRICE FROM 4PM - 11PM',
    groups: [
      { name: 'COCKTAILS', items: ['Blue Lagoon','Cuba libra','Negroni','Tequila Sunrise','Whiskey Sour'] },
      { name: 'BEERS', items: ['Heineken','Savanna','Smirnoff ice','Budweriser','Corona'] },
      { name: 'SPIRITS', items: ['Jose Cuervo gold','Jose cuervo silver','Bacardi rum','Klipdrift','Absolut Vodka','Bombay Gin','Red label whisky'] },
      { name: 'WINES', items: ['Visitana Red','Visitana Rose','Vistana White'] }
    ]
  };

  function makeHappyHourButton(){
    const btn = el('button','offer-hh-btn','HAPPY HOUR MENU');
    btn.type = 'button';
    btn.addEventListener('click', openHappyHour);
    return btn;
  }

  function buildHappyHourPanel(){
    const panel = el('div','happy-hour-panel');
    const head = el('div','happy-hour-head');
    const back = el('button','happy-hour-back','← Back');
    back.setAttribute('aria-label','Back to weekly offers');
    back.addEventListener('click', closeHappyHour);
    const title = el('h3','happy-hour-title', HAPPY_HOUR.title);
    head.appendChild(back);
    head.appendChild(title);
    panel.appendChild(head);
    const grid = el('div','happy-hour-groups');
    HAPPY_HOUR.groups.forEach(g => {
      const gBox = el('div','hh-group');
      const gTitle = el('h4','hh-group-title', g.name);
      const list = el('ul','hh-group-list');
      g.items.forEach(it => list.appendChild(el('li','', it)));
      gBox.appendChild(gTitle);
      gBox.appendChild(list);
      grid.appendChild(gBox);
    });
    panel.appendChild(grid);
    return panel;
  }

  function openHappyHour(){
    const panel = document.querySelector('.happy-hour-panel');
    const offersPanel = document.querySelector('.offers-panel');
    if(!panel || !offersPanel) return;
    offersPanel.classList.add('hh-open');
    panel.scrollTop = 0;
  }

  function closeHappyHour(){
    const offersPanel = document.querySelector('.offers-panel');
    if(!offersPanel) return; offersPanel.classList.remove('hh-open');
  }

  /* ===== Confetti (launch when offers modal opens) ===== */
  function launchConfetti(container){
    const layer = el('div','confetti-layer');
    container.appendChild(layer);
    const colors = ['#e8d9a8','#c3ac6e','#fff','#d4c28b','#bfa76a'];
    const pieces = 24;
    for(let i=0;i<pieces;i++){
      const p = el('div','confetti-piece');
      p.style.left = Math.random()*100+'%';
      p.style.background = colors[Math.floor(Math.random()*colors.length)];
      p.style.animationDelay = (Math.random()*0.6)+'s';
      p.style.transform = `translateY(-20px) rotate(${Math.random()*360}deg)`;
      layer.appendChild(p);
    }
    setTimeout(()=> layer.remove(), 3200);
  }

  // Enhance buildModal to fire confetti after open
  const _buildModalOrig = buildModal;
  buildModal = function(offers){
    _buildModalOrig(offers);
    // Wait a frame then fire confetti inside the today box
    setTimeout(()=>{
      const box = document.querySelector('.offer-today-box');
      if(box) launchConfetti(box);
    }, 300);
  };

  // Kick off reveal animations on load
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', ()=> { initReveal(); }); else initReveal();

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
// cSpell: enable
