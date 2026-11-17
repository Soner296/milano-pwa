import data from './data.js';
import openPlzStreets from './openplz-streets.js';

const byId = id => document.getElementById(id);
const input = byId('query');
const filters = byId('filters');
const results = byId('results');
const tabs = [byId('menu-tab'), byId('address-tab')];
const state = [{ query: '', filter: '' }, { query: '', filter: '' }];
const categories = [...new Set(data.menu.map(row => row[2]))];
const euros = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const collator = new Intl.Collator('de');
const price = cents => euros.format(cents / 100);
const normalize = value => value.toLowerCase().replaceAll('ß', 'ss').replaceAll('ı', 'i').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim();
const searchKey = value => normalize(value).replaceAll(' ', '');
const towns = Object.entries(data.towns).sort(([a], [b]) => collator.compare(a, b));
const streets = [...data.streets, ...openPlzStreets]
  .sort(([a, t1], [b, t2]) => collator.compare(a, b) || collator.compare(t1, t2));
const streetsByTown = new Map(towns.map(([town]) => [town, []]));
for (const entry of streets) streetsByTown.get(entry[1]).push(entry);
const sharedStreetArea = town => ['Colgenstein', 'Heidesheim'].includes(town) ? 'Colgenstein-Heidesheim' : null;
const menuIndex = new Map(data.menu.filter(([code]) => code).map(row => [Number(row[0]), row]));
let active = 0;

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function menuCard([code, name, category, prices], size) {
  const card = el('li', null, 'card');
  const text = el('div');
  text.append(el('span', name, 'name'), el('span', category, 'meta'));
  const values = el('div', null, 'prices');
  const labels = prices.length === 2 ? ['M · 36 cm', 'G · 40 cm'] : code === '16' ? ['Ø 50 cm'] : [''];
  prices.forEach((amount, index) => {
    if (size != null && index !== size) return;
    const value = el('div');
    value.append(el('span', price(amount), 'price'));
    if (labels[index]) value.append(el('span', labels[index], 'size'));
    values.append(value);
  });
  card.append(el('span', code ?? '–', 'number'), text, values);
  return card;
}

function mapsLink(street, town) {
  const link = el('a', 'Google Maps ↗', 'maps-link');
  const query = [street, data.mapPlaces?.[town] ?? town, 'Deutschland'].join(', ');
  link.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
  link.target = '_blank';
  link.rel = 'noopener';
  link.setAttribute('aria-label', street + ', ' + town + ' — Google Maps’te aç');
  return link;
}

function addressCard(name, town, minimum) {
  const card = el('li', null, 'card address-card');
  const description = el('div');
  description.append(el('span', name, 'name'));
  description.append(el('span', sharedStreetArea(town) ?? town, 'meta'), mapsLink(name, town));
  const amount = el('div', null, 'prices');
  const value = el('div');
  value.append(el('span', minimum + ' €', 'price'), el('span', 'Min. sipariş', 'size'));
  amount.append(value);
  card.append(description, amount);
  return card;
}

function townCard(town, minimum) {
  const card = el('li', null, 'town-card');
  const button = el('button', null, 'town-button');
  button.type = 'button';
  button.dataset.town = town;
  const label = el('span');
  const entries = streetsByTown.get(town);
  label.append(el('span', town, 'name'), el('span', entries.length + ' doğrulanmış sokak', 'meta'));
  const amount = el('span');
  amount.append(el('span', minimum + ' €', 'price'), el('span', 'Min. sipariş', 'size'));
  button.append(label, amount);
  button.addEventListener('click', () => {
    const entry = { milanoAddress: { ...state[1], scroll: window.scrollY }, town };
    history.replaceState({ milanoAddress: entry.milanoAddress, returnTown: town }, '');
    history.pushState(entry, '');
    showTown(town);
  });
  card.append(button);
  return card;
}

function showTown(town) {
  const entries = streetsByTown.get(town);
  const title = byId('town-title');
  title.textContent = town;
  byId('town-count').textContent = entries.length + ' doğrulanmış sokak';
  byId('town-minimum').textContent = 'Minimum sipariş ' + data.towns[town] + ' €';
  const shared = sharedStreetArea(town);
  const note = byId('town-note');
  note.textContent = shared ? shared + ' ortak sokak listesi' : 'Bu yer için henüz doğrulanmış sokak kaydı yok.';
  note.hidden = entries.length > 0 && !shared;
  byId('town-streets').replaceChildren(...entries.map(([street]) => {
    const item = el('li');
    item.append(el('span', street), mapsLink(street, town));
    return item;
  }));
  byId('main-tabs').hidden = true;
  byId('results-panel').hidden = true;
  byId('town-panel').hidden = false;
  window.scrollTo(0, 0);
  title.focus({ preventScroll: true });
}

function restoreAddress(entry) {
  state[1] = { query: entry.milanoAddress.query, filter: entry.milanoAddress.filter };
  byId('town-panel').hidden = true;
  byId('main-tabs').hidden = false;
  byId('results-panel').hidden = false;
  selectTab(1);
  if (streetsByTown.has(entry.town)) {
    showTown(entry.town);
    return;
  }
  const button = [...results.querySelectorAll('[data-town]')].find(item => item.dataset.town === entry.returnTown);
  button?.focus({ preventScroll: true });
  window.scrollTo(0, entry.milanoAddress.scroll);
}

function renderMenu(query, filter) {
  const tokens = query.trim().split(/[\s,;]+/);
  const coded = tokens.every(token => /^\d{1,3}[mg]?$/i.test(token));
  const total = byId('total');
  if (coded && (tokens.length > 1 || /[mg]$/i.test(tokens[0]))) {
    const cards = [];
    const missing = [];
    let sum = 0;
    for (const token of tokens) {
      const row = menuIndex.get(parseInt(token, 10));
      const suffix = token.slice(-1).toLowerCase();
      const size = {m: 0, g: 1}[suffix];
      if (!row || (size != null && row[3].length !== 2) || (size == null && row[3].length === 2)) {
        missing.push(token);
        continue;
      }
      cards.push(menuCard(row, size));
      sum += row[3][size ?? 0];
    }
    total.textContent = missing.length
      ? 'Kod veya boyut kontrolü: ' + missing.join(', ') + (cards.length ? ' · Ara toplam ' + price(sum) : '')
      : 'Toplam ' + price(sum);
    total.hidden = false;
    return cards;
  }
  const key = searchKey(query);
  return data.menu.filter(([code, name, category]) => {
    const matches = /^\d+$/.test(query.trim()) ? code != null && Number(code) === Number(query) : searchKey(name).includes(key);
    return matches && (!filter || category === filter);
  }).map(row => menuCard(row));
}

function renderAddresses(query, filter) {
  const key = searchKey(query);
  const terms = normalize(query).split(' ');
  const matchesZone = town => !filter || data.towns[town] === Number(filter);
  const townCards = towns.filter(([town]) => matchesZone(town) &&
    (searchKey(town).includes(key) || searchKey((data.mapPlaces[town] ?? town).split(',')[0]) === key))
    .map(([town, minimum]) => townCard(town, minimum));
  if (!key || towns.some(([town]) => searchKey(town) === key)) return townCards;
  const streetCards = [];
  const shown = new Set();
  for (const [street, town] of streets) {
    if (!matchesZone(town)) continue;
    const streetKey = searchKey(street);
    const combinedKey = searchKey(street + ' ' + town);
    if (!streetKey.includes(key) &&
        !(terms.some(term => streetKey.includes(term)) && terms.every(term => combinedKey.includes(term)))) continue;
    const entryKey = (sharedStreetArea(town) ?? town) + '|' + streetKey;
    if (shown.has(entryKey)) continue;
    shown.add(entryKey);
    streetCards.push(addressCard(street, town, data.towns[town]));
  }
  return [...townCards, ...streetCards];
}

function render() {
  const { query, filter } = state[active];
  byId('total').hidden = true;
  const cards = active === 0 ? renderMenu(query, filter) : renderAddresses(query, filter);
  byId('count').textContent = cards.length + ' sonuç';
  results.replaceChildren(...(cards.length ? cards : [el('li', 'Sonuç bulunamadı.', 'empty')]));
}

function renderFilters() {
  const choices = active === 0 ? categories.map(label => [label, label]) : [12, 17, 22, 27].map(value => [String(value), value + ' €']);
  const buttons = [['', 'Tümü'], ...choices].map(([value, label]) => {
    const button = el('button', label);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(state[active].filter === value));
    button.addEventListener('click', () => {
      state[active].filter = value;
      for (const item of filters.children) item.setAttribute('aria-pressed', String(item === button));
      render();
    });
    return button;
  });
  filters.replaceChildren(...buttons);
}

function selectTab(index) {
  active = index;
  tabs.forEach((tab, i) => {
    tab.setAttribute('aria-selected', String(index === i));
    tab.tabIndex = index === i ? 0 : -1;
  });
  const address = index === 1;
  byId('results-panel').setAttribute('aria-labelledby', tabs[index].id);
  input.value = state[index].query;
  input.placeholder = address ? 'Ör. Grünstadt, Kirchheimer Straße' : 'Numara veya yemek adı';
  byId('search-label').textContent = address ? 'Yer veya sokak ara' : 'Yemek ara';
  byId('hint').textContent = address ? 'Minimum sipariş tutarı teslimat yerine göre gösterilir.' : 'Boyut için 24m veya 27g yaz. Birden fazla kodda toplamı gör.';
  byId('results-title').textContent = address ? 'Teslimat yerleri' : 'Speisekarte';
  byId('coverage').hidden = !address;
  byId('street-attribution').hidden = !address;
  byId('pdf-link').textContent = address ? 'Teslimat haritası (PDF) ↗' : 'Orijinal menü PDF’si ↗';
  byId('pdf-link').href = './speisekarte.pdf#page=' + (address ? 8 : 2);
  renderFilters();
  render();
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(index));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
    selectTab(next);
    tabs[next].focus();
  });
});
input.addEventListener('input', () => {
  state[active].query = input.value;
  render();
});
byId('town-back').addEventListener('click', () => history.back());
window.addEventListener('popstate', event => {
  if (event.state?.milanoAddress) restoreAddress(event.state);
});
if (history.state?.milanoAddress) restoreAddress(history.state);
else selectTab(0);
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Milano offline cache:', error));
}
