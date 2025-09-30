/* Enish Menu Enhancements
   - Responsive navigation (hamburger)
   - Collapsible sections on small screens
   - IntersectionObserver fade-in
   - Persistent open state per page (sessionStorage)
*/
(function(){
  const NAV_BREAKPOINT = 860; // retained for collapsible sections only
  const storageKey = 'enish-collapsed:' + location.pathname;
  const PAGE_SEQUENCE = ['index.html','classic.html','spirits.html','whisky.html','wine.html','beer.html','misc.html'];
  const currentFile = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const loadedPages = new Set([currentFile]);

  // If user reloads (refreshes) any page other than index.html, send them back to index.html
  try {
    const navEntry = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    const isReload = navEntry ? navEntry.type === 'reload' : (performance.navigation && performance.navigation.type === 1);
    if(isReload && !/index\.html?$/.test(location.pathname.split('/').pop()||'')){
      location.replace('index.html');
    }
  } catch(_){ /* ignore */ }

  // Safe storage helpers (avoid private mode or quota errors breaking UI)
  let canStore = true;
  function safeGet(key){
    if(!canStore) return null;
    try { return sessionStorage.getItem(key); } catch(e){ canStore = false; return null; }
  }
  function safeSet(key,val){
    if(!canStore) return; try { sessionStorage.setItem(key,val); } catch(e){ canStore = false; }
  }

  function qs(sel, ctx=document){ return ctx.querySelector(sel); }
  function qsa(sel, ctx=document){ return Array.from(ctx.querySelectorAll(sel)); }

  function ensureActiveNavVisible(nav){
    if(!nav) return;
    const active = nav.querySelector('.active');
    if(!active) return;
    // Desktop: no horizontal shift needed
    if(window.innerWidth > 640){ nav.scrollLeft = 0; return; }
    // Mobile: always left-align the active button so it appears first
    // (simulate bringing it to the front of view without reordering DOM)
    const target = active.offsetLeft; // distance from left edge
    nav.scrollLeft = target;
  }

  // Inject nav toggle if not present
  function enhanceHeader(){
    const header = qs('.site-header-inner') || qs('header');
    if(!header) return;

    // Wrap existing nav
    const navEl = header.querySelector('.menu-nav');
    if(navEl && !navEl.parentElement.classList.contains('menu-shell')){
      const shell = document.createElement('div');
      shell.className = 'menu-shell';
      navEl.parentNode.insertBefore(shell, navEl);
      shell.appendChild(navEl);
    }

    // Insert a full-width separator AFTER navigation to separate categories from menu content
    if(!header.querySelector('.nav-separator')){
      const navShell = header.querySelector('.menu-shell');
      if(navShell){
        const hr = document.createElement('hr');
        hr.className = 'divider nav-separator';
        navShell.insertAdjacentElement('afterend', hr);
      }
    }

    const navFinal = header.querySelector('.menu-nav');
    if(navFinal){
      navFinal.classList.remove('nav-luxe','nav-inline');
      navFinal.classList.add('nav-boxes');
      const current = location.pathname.split('/').pop() || 'index.html';
      qsa('a', navFinal).forEach(a => {
        const href = a.getAttribute('href');
        if(!href) return;
        if(href === current || (current === 'index.html' && href.includes('index'))){
          a.classList.add('active');
          a.setAttribute('aria-current','page');
        } else {
          a.classList.remove('active');
          a.removeAttribute('aria-current');
        }
      });
      // After DOM paints, ensure active is visible/positioned
      requestAnimationFrame(() => ensureActiveNavVisible(navFinal));
    }

    const footerNav = document.querySelector('footer .menu-nav');
    if(footerNav){
      footerNav.classList.remove('nav-luxe','nav-inline');
      footerNav.classList.add('nav-boxes');
      const current = location.pathname.split('/').pop() || 'index.html';
      qsa('a', footerNav).forEach(a => {
        const href = a.getAttribute('href');
        if(!href) return;
        if(href === current || (current === 'index.html' && href.includes('index'))){
          a.classList.add('active');
          a.setAttribute('aria-current','page');
        } else {
          a.classList.remove('active');
          a.removeAttribute('aria-current');
        }
      });
      requestAnimationFrame(() => ensureActiveNavVisible(footerNav));
    }

    // Make logo clickable to force a refresh
    const logo = header.querySelector('.logo');
    if(logo){
      logo.style.cursor = 'pointer';
      logo.addEventListener('click', (e) => {
        e.preventDefault();
        const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
        if(file !== 'index.html'){
          // Direct navigation without extra reload redirect cycle
            window.location.href = 'index.html';
        } else {
          // Already on index: scroll to top smoothly and remove hash if any
          try { history.replaceState(null, '', 'index.html'); } catch(_){}
          window.scrollTo({ top:0, behavior:'smooth' });
        }
      });
    }
  }

  // (Removed multi-page vertical scroll feature)

  function initCollapsibles(){
    // Collapsible feature disabled: always show descriptions on all screen sizes.
    qsa('.menu-item-body').forEach(body => {
      if(body.style.display === 'none') body.style.removeProperty('display');
    });
  }

  function initObserver(){
    if(!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if(e.isIntersecting){ e.target.classList.add('fade-in'); observer.unobserve(e.target); }
      });
    }, {threshold: 0.1});
    qsa('.menu-item').forEach(item => observer.observe(item));
  }

  function initHorizontalNavAutoAdvance(){
    const nav = document.querySelector('.menu-nav');
    if(!nav) return;
    // Ensure horizontal scroll on small devices
    function setup(){
      if(window.innerWidth <= 640){
        nav.classList.add('is-horizontal-scroll');
      } else {
        nav.classList.remove('is-horizontal-scroll');
      }
    }
    setup();
    window.addEventListener('resize', setup, {passive:true});
    window.addEventListener('resize', () => {
      document.querySelectorAll('.menu-nav').forEach(n => ensureActiveNavVisible(n));
    }, {passive:true});
  }

  document.addEventListener('DOMContentLoaded', () => {
    enhanceHeader();
    initCollapsibles();
    initObserver();
    initHorizontalNavAutoAdvance();
    setupSequentialScroll();

    /* Fixed header support on mobile to prevent disappearing logo/nav */
    const header = document.querySelector('.site-header');
    if(header){
      function computeHeaderHeight(){
        const h = header.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--site-header-height', h + 'px');
        if(window.innerWidth <= 760){
          document.body.classList.add('has-fixed-header');
        } else {
          document.body.classList.remove('has-fixed-header');
        }
      }
      computeHeaderHeight();
      window.addEventListener('resize', computeHeaderHeight, {passive:true});
      let lastY = window.scrollY;
      function onScroll(){
        const y = window.scrollY;
        if(y > 20){ header.classList.add('scrolled'); }
        else { header.classList.remove('scrolled'); }
        lastY = y;
      }
      document.addEventListener('scroll', onScroll, {passive:true});
    }
  });

  /* =============================
     Sequential Scroll (Virtual Multi-Page)
     ============================= */
  function setupSequentialScroll(){
    const main = document.querySelector('main');
    if(!main) return;
    // Tag current main as a page chunk
    main.dataset.page = currentFile;
    main.classList.add('page-chunk-initial');

    // Add sentinel if there is a next page
    const nextFile = nextPage(currentFile);
    if(!nextFile) return; // last page
    let sentinel = document.createElement('div');
    sentinel.id = 'page-end-sentinel';
    sentinel.style.width = '100%';
    sentinel.style.height = '40px';
    sentinel.style.pointerEvents = 'none';
    main.insertAdjacentElement('afterend', sentinel);

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if(e.isIntersecting){
          loadNext();
        }
      });
    }, {root:null, threshold:0, rootMargin: '300px 0px 0px 0px'});
    io.observe(sentinel);

    // Observer to update nav active state based on scroll position
    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          const page = entry.target.dataset.page;
          if(page) updateNavActive(page);
        }
      });
    }, {root:null, threshold:0, rootMargin:'-45% 0px -50% 0px'});
    sectionObserver.observe(main);

    function loadNext(){
      io.unobserve(sentinel);
      const curr = lastLoadedPage();
      const nxt = nextPage(curr);
      if(!nxt || loadedPages.has(nxt)) { return; }
      fetch(nxt, {cache:'no-store'}).then(r => r.text()).then(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const m = doc.querySelector('main');
        if(!m){ rearm(); return; }
        const wrapper = document.createElement('section');
        wrapper.className = 'page-chunk';
        wrapper.dataset.page = nxt.toLowerCase();
        // Divider
        const divider = document.createElement('div');
        divider.className = 'page-chunk-divider';
        divider.setAttribute('aria-hidden','true');
        wrapper.appendChild(divider);
        // Copy children
        Array.from(m.children).forEach(ch => wrapper.appendChild(ch.cloneNode(true)));
        // Insert before sentinel (which is currently after last main or previous chunk)
        sentinel.parentNode.insertBefore(wrapper, sentinel);
        loadedPages.add(nxt.toLowerCase());
        sectionObserver.observe(wrapper);
        // Prepare sentinel for potential further load
        rearm();
      }).catch(_ => { rearm(); });
    }

    function rearm(){
      const curr = lastLoadedPage();
      const nxt = nextPage(curr);
      if(!nxt || loadedPages.has(nxt)) { sentinel.remove(); return; }
      io.observe(sentinel);
    }

    function lastLoadedPage(){
      let last = currentFile;
      PAGE_SEQUENCE.forEach(p => { if(loadedPages.has(p)) last = p; });
      return last;
    }
  }

  function nextPage(file){
    const idx = PAGE_SEQUENCE.indexOf(file);
    if(idx === -1) return null;
    return PAGE_SEQUENCE[idx+1] || null;
  }

  function updateNavActive(pageFile){
    const headerNav = document.querySelector('.site-header .menu-nav');
    const footerNav = document.querySelector('footer .menu-nav');
    [headerNav, footerNav].forEach(nav => {
      if(!nav) return;
      nav.querySelectorAll('a').forEach(a => {
        const href = (a.getAttribute('href')||'').toLowerCase();
        if(href === pageFile){
          a.classList.add('active');
          a.setAttribute('aria-current','page');
        } else {
          a.classList.remove('active');
          a.removeAttribute('aria-current');
        }
      });
      // Ensure visibility alignment for mobile horizontal scroll nav
      try { ensureActiveNavVisible(nav); } catch(_){ }
    });
  }

})();
