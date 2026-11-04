const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const packages = JSON.parse(fs.readFileSync(path.join(root, 'data/travel-packages.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'js/script.js'), 'utf8');

function makeElement(value = '') {
  return {
    value,
    hidden: false,
    disabled: false,
    required: false,
    placeholder: '',
    textContent: '',
    dataset: {},
    options: [],
    appendChild(option) { this.options.push(option); },
    replaceChildren() { this.options = []; }
  };
}

function createLogicHarness(mode = '') {
  const ids = {
    'departure-city-field': makeElement(),
    'departure-location-field': makeElement(),
    'departure-city': makeElement('Goa'),
    'departure-city-suggestions': makeElement(),
    'departure-location': makeElement(),
    'departure-location-suggestions': makeElement(),
    'departure-location-label': makeElement(),
    'booking-summary-departure': makeElement()
  };
  let selectedMode = mode;
  const document = {
    addEventListener() {},
    getElementById(id) { return ids[id] || null; },
    createElement() { return makeElement(); },
    querySelector(selector) {
      return selector === 'input[name="travel_mode_choice"]:checked' && selectedMode
        ? { value: selectedMode }
        : null;
    },
    querySelectorAll() { return []; }
  };
  const context = vm.createContext({ document, console, Intl, URL, URLSearchParams, fetch() {} });
  vm.runInContext(`${source}\ntravelPackages = ${JSON.stringify(packages)};`, context);
  return { context, ids, setMode(value) { selectedMode = value; } };
}

test('package JSON has unique names and SQL seed metadata matches it', () => {
  const names = packages.map((item) => item.name.toLocaleLowerCase());
  assert.equal(new Set(names).size, names.length, 'package names must be unique');

  for (const item of packages) {
    assert.ok(item.name && item.country && item.duration);
    const durationNights = Number(item.duration.match(/(\d+)\s*nights?/i)?.[1]);
    assert.equal(item.nights, durationNights, `${item.name} duration/nights`);
    assert.ok(Number.isInteger(item.nights) && item.nights > 0);
    assert.ok(Number.isFinite(item.price) && item.price > 0);
    for (const rate of ['hotelRate', 'activityRate', 'transportRate', 'foodRate', 'otherCost']) {
      assert.ok(Number.isFinite(item[rate]) && item[rate] >= 0, `${item.name} ${rate}`);
    }
  }

  const sql = fs.readFileSync(path.join(root, 'database/travelmate_db.sql'), 'utf8');
  const seeded = new Map([...sql.matchAll(/\('([^']+)', '([^']+)', '(Domestic|International)', '([^']+)', ([\d.]+),/g)]
    .map((match) => [match[1], { country: match[2], category: match[3], duration: match[4], price: Number(match[5]) }]));
  assert.equal(seeded.size, packages.length, 'SQL seed should contain every package exactly once');
  for (const item of packages) {
    const row = seeded.get(item.name);
    assert.ok(row, `missing SQL package ${item.name}`);
    assert.equal(row.country, item.country, `${item.name} country`);
    assert.equal(row.category, item.country === 'India' ? 'Domestic' : 'International', `${item.name} category`);
    assert.equal(row.duration, item.duration, `${item.name} duration`);
    assert.equal(row.price, item.price, `${item.name} price`);
  }
});

test('HTML pages have unique IDs and all local links and assets resolve', () => {
  const pages = fs.readdirSync(root).filter((name) => name.endsWith('.html'));
  assert.ok(pages.length >= 7);
  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${page} contains duplicate IDs`);
    for (const [, reference] of html.matchAll(/(?:href|src)="([^"]+)"/gi)) {
      if (/^(?:https?:|mailto:|tel:|#|javascript:)/i.test(reference)) continue;
      const localPath = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
      if (localPath) assert.ok(fs.existsSync(path.resolve(root, localPath)), `${page} references missing ${reference}`);
    }
  }
});

test('domestic city suggestions do not auto-fill a station or airport', () => {
  const { context, ids } = createLogicHarness('Train');
  context.updateDepartureLocationControls(packages[0], 'Train');
  assert.equal(ids['departure-location-field'].hidden, false);
  assert.equal(ids['departure-location'].required, true);
  assert.ok(ids['departure-location-suggestions'].options.some((item) => item.value === 'Madgaon Junction (MAO)'));
  assert.equal(ids['departure-location'].value, '');
});

test('switching from a suggested station to Flight clears the stale station', () => {
  const { context, ids, setMode } = createLogicHarness('Train');
  ids['departure-location'].value = 'Madgaon Junction (MAO)';
  ids['departure-location'].dataset.suggestedValue = 'Madgaon Junction (MAO)';
  setMode('Flight');
  context.updateDepartureLocationControls(packages[0], 'Flight');
  assert.equal(ids['departure-location-label'].textContent, 'Departure Airport');
  assert.equal(ids['departure-location'].value, '');
  assert.ok(ids['departure-location-suggestions'].options.some((item) => item.value === 'Manohar International Airport (GOX)'));
});

test('international packages keep departure city editable and clear domestic location state', () => {
  const { context, ids } = createLogicHarness('');
  ids['departure-location'].value = 'Madgaon Junction (MAO)';
  ids['departure-location'].dataset.suggestedValue = 'Madgaon Junction (MAO)';
  context.updateDepartureLocationControls(packages.find((item) => item.name === 'Bali Island Escape'), '');
  assert.equal(ids['departure-city-field'].hidden, false);
  assert.equal(ids['departure-city'].disabled, false);
  assert.equal(ids['departure-city'].required, true);
  assert.equal(ids['departure-location-field'].hidden, true);
  assert.equal(ids['departure-location'].disabled, true);
  assert.equal(ids['departure-location'].required, false);
  assert.equal(ids['departure-location'].value, '');
  assert.equal(ids['departure-location'].dataset.suggestedValue, '');
  assert.equal(ids['departure-location-suggestions'].options.length, 0);
});

test('calculator totals are finite and add up across packages, groups, nights, and lodging choices', () => {
  const { context } = createLogicHarness();
  for (const item of packages) {
    for (const [adults, children, nights] of [[1, 0, 1], [1, 19, 30], [10, 10, 4]]) {
      for (const multiplier of [0.75, 1, 1.5]) {
        const result = context.calculateTripCost(item.name, adults, children, nights, multiplier);
        const sum = result.hotel + result.activity + result.transport + result.food + result.other;
        assert.ok(Object.values(result).every(Number.isFinite), item.name);
        assert.equal(result.total, sum, item.name);
      }
    }
  }
});
