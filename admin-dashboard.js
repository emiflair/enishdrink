const PAGE_CONFIG = [
  { id: 'signature', label: 'Signature Cocktails', file: 'index.html', sectionSelector: 'main .misc-section' },
  { id: 'classic', label: 'Classic Cocktails & Shots', file: 'classic.html', sectionSelector: 'main .misc-section' },
  { id: 'spirits', label: 'Spirits', file: 'spirits.html', sectionSelector: 'main .spirits-section' },
  { id: 'whisky', label: 'Whisky & Cognac', file: 'whisky.html', sectionSelector: 'main .misc-section' },
  { id: 'wine', label: 'Champagne & Wine', file: 'wine.html', sectionSelector: 'main .misc-section' },
  { id: 'beer', label: 'Beer & Aperitif', file: 'beer.html', sectionSelector: 'main .misc-section' },
  { id: 'misc', label: 'Miscellaneous', file: 'misc.html', sectionSelector: 'main .misc-section' }
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const state = {
  pages: new Map(),
  current: null,
  offers: null
};

const pageListEl = document.getElementById('pageList');
const workspaceEl = document.getElementById('workspace');
const toastEl = document.getElementById('toast');
const navButtons = new Map();
let toastTimer = null;

init();

function init() {
  renderNav();
  updateServerStatus();
  const offersBtn = document.querySelector('button[data-view="offers"]');
  offersBtn?.addEventListener('click', () => openOffersView());
  window.addEventListener('beforeunload', handleBeforeUnload);
}

function deepClone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function renderNav() {
  const fragment = document.createDocumentFragment();
  PAGE_CONFIG.forEach((def) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-button';
    btn.textContent = def.label;
    btn.dataset.view = def.id;
    btn.addEventListener('click', () => openMenuPage(def.id));
    fragment.appendChild(btn);
    navButtons.set(def.id, btn);
  });
  pageListEl.appendChild(fragment);
}

function updateServerStatus() {
  const badge = document.getElementById('serverStatus');
  if (!badge) return;
  if (location.protocol.startsWith('http')) {
    badge.classList.remove('warn');
    badge.textContent = 'Local server detected';
  } else {
    badge.classList.add('warn');
    badge.textContent = 'Local server required (for file fetch)';
  }
}

function openMenuPage(pageId) {
  const def = getPageDef(pageId);
  if (!def) return;
  setActiveNav(pageId);
  workspaceLoading(`Loading ${def.label}…`);
  loadPageState(pageId)
    .then((pageState) => {
      renderMenuWorkspace(pageState);
      state.current = { type: 'menu', id: pageId };
    })
    .catch((err) => {
      console.error(err);
      workspaceError('Unable to load the requested page. Ensure you are serving the site via a local web server.');
    });
}

function openOffersView() {
  setActiveNav('offers');
  workspaceLoading('Loading weekly offers…');
  loadOffersState()
    .then((offersState) => {
      renderOffersWorkspace(offersState);
      state.current = { type: 'offers', id: 'offers' };
    })
    .catch((err) => {
      console.error(err);
      workspaceError('Unable to load offers.json. Confirm that the file exists and you are running a local server.');
    });
}

function loadPageState(pageId) {
  if (state.pages.has(pageId)) return Promise.resolve(state.pages.get(pageId));
  const def = getPageDef(pageId);
  return fetch(def.file, { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch ${def.file}`);
      return res.text();
    })
    .then((html) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const sections = extractSections(doc, def);
      const pageState = {
        id: pageId,
        def,
        doc,
        originalHtml: html,
        sections,
        dirty: false,
        statusEl: null,
        downloadBtn: null,
        resetBtn: null,
        copyBtn: null,
        saveControls: null
      };
      state.pages.set(pageId, pageState);
      return pageState;
    });
}

function extractSections(doc, def) {
  const sectionNodes = Array.from(doc.querySelectorAll(def.sectionSelector));
  const sections = [];
  sectionNodes.forEach((sectionEl, index) => {
    const sectionState = buildSectionState(sectionEl, index, def);
    if (sectionState) sections.push(sectionState);
  });
  return sections;
}

function buildSectionState(sectionEl, index, def) {
  const titleEl = sectionEl.querySelector('h2, h3');
  const title = titleEl ? titleEl.textContent.trim() : `Section ${index + 1}`;
  const container = findSectionContainer(sectionEl);
  if (!container) return null;
  const itemSelector = determineItemSelector(container);
  if (!itemSelector) return null;
  const itemNodes = Array.from(container.querySelectorAll(itemSelector));
  if (!itemNodes.length) return null;
  const template = itemNodes[0].cloneNode(true);
  const headerLabels = Array.from(sectionEl.querySelectorAll('.misc-header-labels span, .spirits-header span, .wine-header span'))
    .map((el) => el.textContent.trim())
    .filter(Boolean);
  const sample = readItemNode(itemNodes[0], headerLabels);
  const priceLabels = sample.prices.map((p) => p.label);
  const usesDescription = sample.description !== null;
  const sectionState = {
    id: `${def.id}-section-${index}`,
    title,
    element: sectionEl,
    container,
    itemSelector,
    template,
    headerLabels,
    priceLabels,
    usesDescription,
    structure: sample.structure,
    items: []
  };
  itemNodes.forEach((node, idx) => {
    const data = readItemNode(node, headerLabels, sectionState.priceLabels);
    const normalizedPrices = sectionState.priceLabels.map((label, labelIdx) => ({
      label,
      value: data.prices[labelIdx] ? data.prices[labelIdx].value : ''
    }));
    sectionState.items.push({
      id: `${sectionState.id}-item-${idx}`,
      name: data.name,
      description: usesDescription ? data.description ?? '' : null,
      prices: normalizedPrices,
      removed: false,
      isNew: false
    });
  });
  return sectionState;
}

function findSectionContainer(sectionEl) {
  const selectors = [
    '.misc-table',
    '.classic-list',
    '.spirits-table',
    '.wine-table',
    '.beer-table',
    '.menu-section',
    '.misc-table'
  ];
  for (const selector of selectors) {
    const found = sectionEl.querySelector(selector);
    if (found) return found;
  }
  return sectionEl;
}

function determineItemSelector(container) {
  const selectors = [
    '.menu-item',
    '.misc-item',
    '.spirits-item',
    '.wine-item',
    '.beer-item',
    '.classic-list li',
    ':scope > .misc-item'
  ];
  for (const selector of selectors) {
    if (container.querySelector(selector)) return selector;
  }
  return null;
}

function readItemNode(node, headerLabels, overrideLabels) {
  const nameEl = findNameElement(node);
  const descriptionEl = findDescriptionElement(node);
  const priceGroup = findPriceGroup(node);
  const standalonePrices = findStandalonePriceElements(node);
  const priceElements = priceGroup
    ? Array.from(priceGroup.querySelectorAll('span, strong'))
    : standalonePrices;
  const labels = computePriceLabels(headerLabels, priceElements, priceGroup, overrideLabels);
  const prices = priceElements.map((el, idx) => ({
    label: labels[idx] || `Price ${idx + 1}`,
    value: getNodeText(el)
  }));
  return {
    name: getNodeText(nameEl),
    description: descriptionEl ? getNodeText(descriptionEl) : null,
    prices,
    structure: {
      hasPriceGroup: !!priceGroup
    }
  };
}

function findNameElement(node) {
  const selectors = ['.menu-item-name', '.misc-name', '.wine-name', '.spirit-name', '.beer-name'];
  for (const selector of selectors) {
    const el = node.querySelector(selector);
    if (el) return el;
  }
  const directChild = Array.from(node.children).find((child) => !isPriceElement(child));
  return directChild || node;
}

function findDescriptionElement(node) {
  const selectors = ['.menu-item-body p', '.misc-description'];
  for (const selector of selectors) {
    const el = node.querySelector(selector);
    if (el) return el;
  }
  return null;
}

function findPriceGroup(node) {
  return node.querySelector('.misc-price-group, .price-group');
}

function findStandalonePriceElements(node) {
  const selectors = [
    '.menu-item-price',
    '.misc-price',
    '.misc-price-ml',
    '.misc-price-bottle',
    '.wine-price',
    '.wine-amount',
    '.spirit-price',
    '.spirit-amount',
    '.beer-price'
  ];
  const elements = [];
  const seen = new Set();
  selectors.forEach((selector) => {
    node.querySelectorAll(selector).forEach((el) => {
      if (el.closest('.misc-price-group, .price-group')) return;
      if (!seen.has(el)) {
        elements.push(el);
        seen.add(el);
      }
    });
  });
  if (!elements.length) {
    const candidate = Array.from(node.children).filter((child) => child !== findNameElement(node));
    const hasNumbers = candidate.filter((child) => /\d/.test(child.textContent));
    if (hasNumbers.length) return hasNumbers;
  }
  return elements;
}

function computePriceLabels(headerLabels, priceElements, priceGroup, override) {
  if (override && override.length) return override;
  if (headerLabels.length >= priceElements.length) return headerLabels.slice(0, priceElements.length);
  if (priceElements.length === 1) return ['Price'];
  return priceElements.map((_, idx) => `Price ${idx + 1}`);
}

function isPriceElement(el) {
  return /price|amount/i.test(el.className || '');
}

function getNodeText(el) {
  return (el ? el.textContent : '').trim();
}

function renderMenuWorkspace(pageState) {
  workspaceEl.innerHTML = '';
  workspaceEl.dataset.view = 'menu';
  const header = document.createElement('div');
  header.className = 'workspace-header';

  const title = document.createElement('h2');
  title.textContent = pageState.def.label;
  header.appendChild(title);

  const status = document.createElement('span');
  status.className = 'pill';
  header.appendChild(status);
  pageState.statusEl = status;

  workspaceEl.appendChild(header);

  const sectionsWrap = document.createElement('div');
  sectionsWrap.className = 'sections';
  sectionsWrap.id = 'sectionsWrap';
  workspaceEl.appendChild(sectionsWrap);

  populateSections(pageState);
  const saveControls = createSaveBar({
    dirtyTitle: 'Unsaved changes',
    dirtyMessage: 'Download or copy the updated HTML to keep your edits.',
    cleanMessage: 'All changes synced.',
    actions: [
      {
        key: 'save',
        label: 'Download HTML',
        variant: 'primary',
        disabled: !pageState.dirty,
        onClick: () => {
          try {
            const html = applyPageChanges(pageState);
            downloadFile(pageState.def.file, html, 'text/html');
            markPageClean(pageState);
            showToast(`Downloaded ${pageState.def.file}`);
          } catch (error) {
            console.error(error);
            showToast('Unable to generate updated HTML');
          }
        }
      },
      {
        key: 'copy',
        label: 'Copy HTML',
        variant: 'secondary',
        disabled: !pageState.dirty,
        onClick: () => {
          if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
            showToast('Clipboard API unavailable in this browser');
            return;
          }
          try {
            const html = applyPageChanges(pageState);
            navigator.clipboard
              .writeText(html)
              .then(() => {
                markPageClean(pageState);
                showToast('Updated HTML copied to clipboard');
              })
              .catch((err) => {
                console.error(err);
                showToast('Clipboard copy failed. Try download instead.');
              });
          } catch (error) {
            console.error(error);
            showToast('Unable to generate updated HTML');
          }
        }
      },
      {
        key: 'reset',
        label: 'Reset',
        variant: 'secondary',
        disabled: !pageState.dirty,
        onClick: () => {
          resetPageState(pageState.id);
        }
      }
    ]
  });
  pageState.saveControls = saveControls;
  pageState.downloadBtn = saveControls.buttons.save;
  pageState.copyBtn = saveControls.buttons.copy;
  pageState.resetBtn = saveControls.buttons.reset;
  workspaceEl.appendChild(saveControls.bar);
  saveControls.setDirtyState(pageState.dirty);
  updatePageStatus(pageState);
}

function populateSections(pageState) {
  const wrap = document.getElementById('sectionsWrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  pageState.sections.forEach((section) => {
    wrap.appendChild(renderSectionCard(section, pageState));
  });
}

function renderSectionCard(sectionState, pageState) {
  const card = document.createElement('div');
  card.className = 'section-card';

  const header = document.createElement('header');
  const h3 = document.createElement('h3');
  h3.textContent = sectionState.title;
  header.appendChild(h3);
  const meta = document.createElement('div');
  meta.className = 'section-meta';
  meta.textContent = `${sectionState.items.filter((item) => !item.removed).length} items`;
  header.appendChild(meta);
  card.appendChild(header);

  const itemsTable = document.createElement('div');
  itemsTable.className = 'items-table';
  sectionState.items.forEach((item) => {
    itemsTable.appendChild(renderItemEditor(sectionState, item, pageState));
  });
  if (!sectionState.items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No items in this section yet.';
    itemsTable.appendChild(empty);
  }
  card.appendChild(itemsTable);

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'action secondary';
  addBtn.textContent = 'Add Item';
  addBtn.addEventListener('click', () => {
    const newItem = createBlankItem(sectionState);
    sectionState.items.push(newItem);
    markPageDirty(pageState);
    populateSections(pageState);
    showToast('New item added to section');
  });
  card.appendChild(addBtn);

  return card;
}

function renderItemEditor(sectionState, itemState, pageState) {
  const editor = document.createElement('div');
  editor.className = 'item-editor';
  if (itemState.removed) editor.classList.add('deleted');

  const nameField = createField('Name', itemState.name, (value) => {
    itemState.name = value;
    markPageDirty(pageState);
  });
  editor.appendChild(nameField);

  sectionState.priceLabels.forEach((label, idx) => {
    const priceField = createField(label || `Price ${idx + 1}`, itemState.prices[idx]?.value || '', (value) => {
      const entry = ensurePriceEntry(sectionState, itemState, idx);
      entry.value = value;
      markPageDirty(pageState);
    });
    editor.appendChild(priceField);
  });

  if (sectionState.usesDescription) {
    const descField = createTextarea('Description', itemState.description || '', (value) => {
      itemState.description = value;
      markPageDirty(pageState);
    });
    editor.appendChild(descField);
  }

  const actions = document.createElement('div');
  actions.className = 'item-actions';
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'action danger';
  deleteBtn.textContent = itemState.removed ? 'Undo Delete' : 'Delete';
  deleteBtn.addEventListener('click', () => {
    itemState.removed = !itemState.removed;
    markPageDirty(pageState);
    populateSections(pageState);
  });
  actions.appendChild(deleteBtn);
  editor.appendChild(actions);

  return editor;
}

function createField(label, value, onInput) {
  const field = document.createElement('div');
  field.className = 'field';
  const lab = document.createElement('label');
  lab.textContent = label;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.addEventListener('input', (e) => onInput(e.target.value));
  field.append(lab, input);
  return field;
}

function createTextarea(label, value, onInput) {
  const field = document.createElement('div');
  field.className = 'field';
  const lab = document.createElement('label');
  lab.textContent = label;
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.addEventListener('input', (e) => onInput(e.target.value));
  field.append(lab, textarea);
  return field;
}

function ensurePriceEntry(sectionState, itemState, idx) {
  if (!itemState.prices[idx]) {
    itemState.prices[idx] = { label: sectionState.priceLabels[idx] || `Price ${idx + 1}`, value: '' };
  }
  return itemState.prices[idx];
}

function createBlankItem(sectionState) {
  return {
    id: `${sectionState.id}-new-${Date.now()}`,
    name: '',
    description: sectionState.usesDescription ? '' : null,
    prices: sectionState.priceLabels.map((label) => ({ label, value: '' })),
    removed: false,
    isNew: true
  };
}

function applyPageChanges(pageState) {
  pageState.sections.forEach((section) => {
    const container = section.container;
    const template = section.template;
    const currentNodes = Array.from(container.querySelectorAll(section.itemSelector));
    currentNodes.forEach((node) => node.remove());
    section.items
      .filter((item) => !item.removed)
      .forEach((item) => {
        const node = template.cloneNode(true);
        writeItemNode(node, item, section);
        container.appendChild(node);
      });
  });
  const serializer = new XMLSerializer();
  const html = serializer.serializeToString(pageState.doc);
  return '<!DOCTYPE html>\n' + html;
}

function writeItemNode(node, itemData, sectionState) {
  const nameEl = findNameElement(node);
  if (nameEl) nameEl.textContent = itemData.name.trim();
  if (sectionState.usesDescription) {
    const descEl = findDescriptionElement(node);
    if (descEl) descEl.textContent = itemData.description ? itemData.description.trim() : '';
  }
  const priceGroup = findPriceGroup(node);
  if (priceGroup) {
    const spans = Array.from(priceGroup.querySelectorAll('span, strong'));
    itemData.prices.forEach((price, idx) => {
      if (spans[idx]) spans[idx].textContent = price.value.trim();
    });
    for (let i = itemData.prices.length; i < spans.length; i += 1) {
      spans[i].textContent = '';
    }
  } else {
    const priceEls = findStandalonePriceElements(node);
    itemData.prices.forEach((price, idx) => {
      if (priceEls[idx]) priceEls[idx].textContent = price.value.trim();
    });
    for (let i = itemData.prices.length; i < priceEls.length; i += 1) {
      priceEls[i].textContent = '';
    }
  }
}

function markPageDirty(pageState) {
  if (!pageState.dirty) {
    pageState.dirty = true;
    updatePageStatus(pageState);
  }
  pageState.saveControls?.setDirtyState(true);
  if (pageState.downloadBtn) pageState.downloadBtn.disabled = false;
  if (pageState.copyBtn) pageState.copyBtn.disabled = false;
  if (pageState.resetBtn) pageState.resetBtn.disabled = false;
}

function markPageClean(pageState) {
  pageState.dirty = false;
  updatePageStatus(pageState);
  pageState.saveControls?.setDirtyState(false);
  if (pageState.downloadBtn) pageState.downloadBtn.disabled = true;
  if (pageState.copyBtn) pageState.copyBtn.disabled = true;
  if (pageState.resetBtn) pageState.resetBtn.disabled = true;
}

function updatePageStatus(pageState) {
  if (!pageState.statusEl) return;
  if (pageState.dirty) {
    pageState.statusEl.textContent = 'Unsaved changes';
    pageState.statusEl.style.background = 'rgba(255,107,107,0.12)';
    pageState.statusEl.style.border = '1px solid rgba(255,107,107,0.35)';
    pageState.statusEl.style.color = '#ff8f8f';
  } else {
    pageState.statusEl.textContent = 'Synced';
    pageState.statusEl.style.background = 'rgba(230,195,99,0.15)';
    pageState.statusEl.style.border = '1px solid rgba(230,195,99,0.35)';
    pageState.statusEl.style.color = 'var(--accent)';
  }
}

function resetPageState(pageId) {
  state.pages.delete(pageId);
  openMenuPage(pageId);
  showToast('Page reset to original content');
}

function loadOffersState() {
  if (state.offers) return Promise.resolve(state.offers);
  return fetch('offers.json', { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error('Failed to load offers.json');
      return res.json();
    })
    .then((json) => {
      const offersState = {
        data: json,
        original: deepClone(json),
        dirty: false,
        downloadBtn: null,
        resetBtn: null,
        copyBtn: null,
        saveControls: null
      };
      state.offers = offersState;
      return offersState;
    });
}

function renderOffersWorkspace(offersState) {
  workspaceEl.innerHTML = '';
  workspaceEl.dataset.view = 'offers';
  const header = document.createElement('div');
  header.className = 'workspace-header';

  const title = document.createElement('h2');
  title.textContent = 'Weekly Offers';
  header.appendChild(title);
  workspaceEl.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'offers-editor';
  grid.id = 'offersEditor';
  workspaceEl.appendChild(grid);

  populateOffersGrid(offersState);

  const saveControls = createSaveBar({
    dirtyTitle: 'Unsaved changes',
    dirtyMessage: 'Download or copy the updated JSON to keep your edits.',
    cleanMessage: 'All changes synced.',
    actions: [
      {
        key: 'save',
        label: 'Download JSON',
        variant: 'primary',
        disabled: !offersState.dirty,
        onClick: () => {
          const content = JSON.stringify(offersState.data, null, 2);
          downloadFile('offers.json', content, 'application/json');
          markOffersClean(offersState);
          showToast('Downloaded offers.json');
        }
      },
      {
        key: 'copy',
        label: 'Copy JSON',
        variant: 'secondary',
        disabled: !offersState.dirty,
        onClick: () => {
          if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
            showToast('Clipboard API unavailable in this browser');
            return;
          }
          const content = JSON.stringify(offersState.data, null, 2);
          navigator.clipboard
            .writeText(content)
            .then(() => {
              markOffersClean(offersState);
              showToast('Updated JSON copied to clipboard');
            })
            .catch((err) => {
              console.error(err);
              showToast('Clipboard copy failed. Try download instead.');
            });
        }
      },
      {
        key: 'reset',
        label: 'Reset',
        variant: 'secondary',
        disabled: !offersState.dirty,
        onClick: () => {
          offersState.data = deepClone(offersState.original);
          markOffersClean(offersState);
          renderOffersWorkspace(offersState);
          showToast('Offers reset to original values');
        }
      }
    ]
  });
  offersState.saveControls = saveControls;
  offersState.downloadBtn = saveControls.buttons.save;
  offersState.copyBtn = saveControls.buttons.copy;
  offersState.resetBtn = saveControls.buttons.reset;
  workspaceEl.appendChild(saveControls.bar);
  saveControls.setDirtyState(offersState.dirty);
}

function populateOffersGrid(offersState) {
  const editor = document.getElementById('offersEditor');
  if (!editor) return;
  editor.innerHTML = '';
  Object.keys(offersState.data)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((key) => {
      editor.appendChild(renderOfferCard(key, offersState));
    });
}

function renderOfferCard(dayKey, offersState) {
  const data = offersState.data[dayKey] || { title: '', lines: [] };
  const card = document.createElement('div');
  card.className = 'offer-card';

  const header = document.createElement('header');
  const h3 = document.createElement('h3');
  h3.textContent = `${DAY_NAMES[Number(dayKey)]} (#${dayKey})`;
  header.appendChild(h3);

  const addLineBtn = document.createElement('button');
  addLineBtn.type = 'button';
  addLineBtn.className = 'action secondary';
  addLineBtn.textContent = 'Add Line';
  addLineBtn.addEventListener('click', () => {
    data.lines = data.lines || [];
    data.lines.push('');
    markOffersDirty(offersState);
    populateOffersGrid(offersState);
  });
  header.appendChild(addLineBtn);
  card.appendChild(header);

  const titleField = createField('Title', data.title || '', (value) => {
    data.title = value;
    markOffersDirty(offersState);
  });
  card.appendChild(titleField);

  const linesWrapper = document.createElement('div');
  linesWrapper.className = 'lines-list';
  (data.lines || []).forEach((line, index) => {
    linesWrapper.appendChild(renderOfferLine(dayKey, index, offersState));
  });
  card.appendChild(linesWrapper);

  return card;
}

function renderOfferLine(dayKey, index, offersState) {
  const data = offersState.data[dayKey];
  const row = document.createElement('div');
  row.className = 'line-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = data.lines[index] || '';
  input.addEventListener('input', (e) => {
    data.lines[index] = e.target.value;
    markOffersDirty(offersState);
  });
  row.appendChild(input);

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.textContent = '✕';
  deleteBtn.addEventListener('click', () => {
    data.lines.splice(index, 1);
    markOffersDirty(offersState);
    populateOffersGrid(offersState);
  });
  row.appendChild(deleteBtn);
  return row;
}

function markOffersDirty(offersState) {
  if (!offersState.dirty) {
    offersState.dirty = true;
    offersState.saveControls?.setDirtyState(true);
  }
  if (offersState.downloadBtn) offersState.downloadBtn.disabled = false;
  if (offersState.resetBtn) offersState.resetBtn.disabled = false;
  if (offersState.copyBtn) offersState.copyBtn.disabled = false;
}

function markOffersClean(offersState) {
  offersState.dirty = false;
  offersState.original = deepClone(offersState.data);
  if (offersState.downloadBtn) offersState.downloadBtn.disabled = true;
  if (offersState.resetBtn) offersState.resetBtn.disabled = true;
  if (offersState.copyBtn) offersState.copyBtn.disabled = true;
  offersState.saveControls?.setDirtyState(false);
}

function createSaveBar({ dirtyTitle, dirtyMessage, cleanMessage, actions }) {
  const bar = document.createElement('div');
  bar.className = 'save-bar hidden';

  const info = document.createElement('div');
  info.className = 'save-info';
  const titleEl = document.createElement('strong');
  titleEl.textContent = dirtyTitle || 'Unsaved changes';
  const messageEl = document.createElement('span');
  if (dirtyMessage) messageEl.textContent = dirtyMessage;
  info.append(titleEl, messageEl);
  bar.appendChild(info);

  const actionsWrap = document.createElement('div');
  actionsWrap.className = 'save-actions';
  const buttons = {};

  (actions || []).forEach((action) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `action ${action.variant || 'secondary'}`;
    btn.textContent = action.label;
    btn.disabled = action.disabled ?? true;
    btn.addEventListener('click', action.onClick);
    actionsWrap.appendChild(btn);
    if (action.key) buttons[action.key] = btn;
  });

  bar.appendChild(actionsWrap);

  function setDirtyState(isDirty) {
    if (isDirty) {
      bar.classList.remove('hidden');
      titleEl.textContent = dirtyTitle || 'Unsaved changes';
      if (dirtyMessage) messageEl.textContent = dirtyMessage;
    } else {
      bar.classList.add('hidden');
      if (cleanMessage) messageEl.textContent = cleanMessage;
    }
  }

  return { bar, messageEl, titleEl, buttons, setDirtyState };
}

function workspaceLoading(message) {
  workspaceEl.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'workspace-header';
  const h2 = document.createElement('h2');
  h2.textContent = message;
  header.appendChild(h2);
  workspaceEl.appendChild(header);
  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  workspaceEl.appendChild(spinner);
}

function workspaceError(message) {
  workspaceEl.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'workspace-header';
  const h2 = document.createElement('h2');
  h2.textContent = 'Error';
  header.appendChild(h2);
  workspaceEl.appendChild(header);
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.textContent = message;
  workspaceEl.appendChild(empty);
}

function setActiveNav(id) {
  navButtons.forEach((button, key) => {
    if (key === id) {
      button.setAttribute('aria-current', 'page');
    } else {
      button.removeAttribute('aria-current');
    }
  });
  const offersBtn = document.querySelector('button[data-view="offers"]');
  if (id === 'offers') offersBtn?.setAttribute('aria-current', 'page');
  else offersBtn?.removeAttribute('aria-current');
}

function getPageDef(id) {
  return PAGE_CONFIG.find((def) => def.id === id);
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2400);
}

function handleBeforeUnload(event) {
  const pageDirty = Array.from(state.pages.values()).some((page) => page.dirty);
  const offersDirty = state.offers && state.offers.dirty;
  if (pageDirty || offersDirty) {
    event.preventDefault();
    event.returnValue = '';
  }
}
