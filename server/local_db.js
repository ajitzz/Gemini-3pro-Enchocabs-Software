const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const STORE_FILE = path.resolve(__dirname, 'local_db_store.json');

const INITIAL_SLABS = [
  { id: '1', slab_type: 'driver', type: 'driver', min_trips: 0, max_trips: 45, rent_amount: 950 },
  { id: '2', slab_type: 'driver', type: 'driver', min_trips: 46, max_trips: 59, rent_amount: 850 },
  { id: '3', slab_type: 'driver', type: 'driver', min_trips: 60, max_trips: 64, rent_amount: 772 },
  { id: '4', slab_type: 'driver', type: 'driver', min_trips: 65, max_trips: 69, rent_amount: 700 },
  { id: '5', slab_type: 'driver', type: 'driver', min_trips: 70, max_trips: null, rent_amount: 550 },
];

const INITIAL_DRIVERS = [
  {
    id: 'd1000000-0000-0000-0000-000000000001',
    name: 'Muhammed Ubais',
    mobile: '9847000001',
    email: 'muhammed.ubais@example.com',
    join_date: '2026-01-01',
    joinDate: '2026-01-01',
    termination_date: null,
    terminationDate: null,
    is_hidden: false,
    isHidden: false,
    deposit: 5000,
    qr_code: 'TERMINAL 5__ Q558711512',
    qrCode: 'TERMINAL 5__ Q558711512',
    vehicle: 'KA51AM2010',
    status: 'Active',
    current_shift: 'Day',
    currentShift: 'Day',
    default_rent: 950,
    defaultRent: 950,
    notes: '',
    is_manager: false,
    isManager: false,
    food_option: false,
    foodOption: false
  },
  {
    id: 'd1000000-0000-0000-0000-000000000002',
    name: 'MUHAMMED ELAVATTASSERY',
    mobile: '9847000002',
    email: 'elavattassery@example.com',
    join_date: '2026-01-01',
    joinDate: '2026-01-01',
    termination_date: null,
    terminationDate: null,
    is_hidden: false,
    isHidden: false,
    deposit: 5000,
    qr_code: 'TERMINAL 11__Q037709407',
    qrCode: 'TERMINAL 11__Q037709407',
    vehicle: 'Unknown',
    status: 'Active',
    current_shift: 'Day',
    currentShift: 'Day',
    default_rent: 800,
    defaultRent: 800,
    notes: '',
    is_manager: false,
    isManager: false,
    food_option: false,
    foodOption: false
  }
];

// Seed initial historical daily entries matching the user's dashboard records
const INITIAL_ENTRIES = [
  { id: 'e1000000-0000-0000-0000-000000000001', date: '2026-08-12', day: 'Wed', vehicle: 'Unknown', driver: 'Muhammed Ubais', shift: 'Day', qr_code: 'TERMINAL 5__ Q558711512', rent: 950, collection: 1000, fuel: 0, due: 0, payout: 50, payout_date: null, notes: '' },
  { id: 'e1000000-0000-0000-0000-000000000002', date: '2026-08-11', day: 'Tue', vehicle: 'Unknown', driver: 'MUHAMMED ELAVATTASSERY', shift: 'Day', qr_code: 'TERMINAL 11__Q037709407', rent: 800, collection: 3150, fuel: 0, due: 0, payout: 2350, payout_date: null, notes: '' },
  { id: 'e1000000-0000-0000-0000-000000000003', date: '2026-08-11', day: 'Tue', vehicle: 'Unknown', driver: 'Muhammed Ubais', shift: 'Day', qr_code: 'TERMINAL 5__ Q558711512', rent: 950, collection: 1000, fuel: 0, due: 0, payout: 50, payout_date: null, notes: '' },
  { id: 'e1000000-0000-0000-0000-000000000004', date: '2026-08-10', day: 'Mon', vehicle: 'KA51AM2010', driver: 'Muhammed Ubais', shift: 'Day', qr_code: 'TERMINAL 5__ Q558711512', rent: 950, collection: 0, fuel: 0, due: 0, payout: -950, payout_date: null, notes: '' },
  { id: 'e1000000-0000-0000-0000-000000000005', date: '2026-08-10', day: 'Mon', vehicle: 'Unknown', driver: 'MUHAMMED ELAVATTASSERY', shift: 'Day', qr_code: 'TERMINAL 11__Q037709407', rent: 800, collection: 0, fuel: 0, due: 0, payout: -800, payout_date: null, notes: '' },
  { id: 'e1000000-0000-0000-0000-000000000006', date: '2026-08-09', day: 'Sun', vehicle: 'Unknown', driver: 'Muhammed Ubais', shift: 'Day', qr_code: 'TERMINAL 5__ Q558711512', rent: 950, collection: 0, fuel: 0, due: 0, payout: -950, payout_date: null, notes: '' },
  { id: 'e1000000-0000-0000-0000-000000000007', date: '2026-08-09', day: 'Sun', vehicle: 'Unknown', driver: 'MUHAMMED ELAVATTASSERY', shift: 'Day', qr_code: 'TERMINAL 11__Q037709407', rent: 800, collection: 1050, fuel: 0, due: 0, payout: 250, payout_date: null, notes: '' },
  { id: 'e1000000-0000-0000-0000-000000000008', date: '2026-08-08', day: 'Sat', vehicle: 'Unknown', driver: 'Muhammed Ubais', shift: 'Day', qr_code: 'TERMINAL 5__ Q558711512', rent: 950, collection: 2000, fuel: 0, due: 0, payout: 1050, payout_date: null, notes: '' },
  { id: 'e1000000-0000-0000-0000-000000000009', date: '2026-08-08', day: 'Sat', vehicle: 'Unknown', driver: 'MUHAMMED ELAVATTASSERY', shift: 'Day', qr_code: 'TERMINAL 11__Q037709407', rent: 800, collection: 1050, fuel: 0, due: 0, payout: 250, payout_date: null, notes: '' },
];

const INITIAL_WALLETS = [
  {
    id: 'w1000000-0000-0000-0000-000000000001',
    driver: 'Muhammed Ubais',
    week_start_date: '2026-08-10',
    week_end_date: '2026-08-16',
    earnings: 4500,
    refund: 0,
    diff: 0,
    cash: 0,
    charges: 250,
    trips: 42,
    wallet_week: 4250,
    rent_override: null,
    days_worked_override: null,
    adjustments: 0,
    notes: ''
  },
  {
    id: 'w1000000-0000-0000-0000-000000000002',
    driver: 'MUHAMMED ELAVATTASSERY',
    week_start_date: '2026-08-10',
    week_end_date: '2026-08-16',
    earnings: 5200,
    refund: 0,
    diff: 0,
    cash: 0,
    charges: 300,
    trips: 55,
    wallet_week: 4900,
    rent_override: null,
    days_worked_override: null,
    adjustments: 0,
    notes: ''
  }
];

function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
      return data;
    }
  } catch (err) {
    console.error('Error reading local db store:', err);
  }

  const initial = {
    rental_slabs: INITIAL_SLABS,
    drivers: INITIAL_DRIVERS,
    daily_entries: INITIAL_ENTRIES,
    weekly_wallets: INITIAL_WALLETS,
    driver_billings: [],
    leaves: [],
    shifts: [],
    expenses: [],
    company_summaries: [],
    admin_access: [{ email: 'enchoenterprises@gmail.com', added_by: 'system', added_at: new Date().toISOString() }],
    manager_access: [],
    assets: [],
    system_flags: [],
    push_subscriptions: []
  };

  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2));
  } catch (err) {
    console.error('Error writing initial local db store:', err);
  }
  return initial;
}

function saveStore(store) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
  } catch (err) {
    console.error('Error saving local db store:', err);
  }
}

let memoryStore = loadStore();

function executeFallbackQuery(text, params = []) {
  const normalized = text.trim();
  const lower = normalized.toLowerCase();

  // 1. Table creation / DDL
  if (lower.startsWith('create table') || lower.startsWith('create extension') || lower.startsWith('create index') || lower.startsWith('alter table')) {
    return { rows: [], rowCount: 0 };
  }

  // 2. Transaction commands
  if (lower === 'begin' || lower === 'commit' || lower === 'rollback') {
    return { rows: [], rowCount: 0 };
  }

  // 3. SELECT rental_slabs
  if (lower.includes('from rental_slabs')) {
    const rows = memoryStore.rental_slabs.map(s => ({
      ...s,
      minTrips: s.min_trips,
      maxTrips: s.max_trips,
      rentAmount: s.rent_amount
    }));
    return { rows, rowCount: rows.length };
  }

  // 4. SELECT drivers
  if (lower.includes('from drivers')) {
    let rawList = [...memoryStore.drivers];
    if (lower.includes('where lower(email) = lower($1)')) {
      const email = String(params[0] || '').toLowerCase();
      rawList = rawList.filter(d => (d.email || '').toLowerCase() === email);
    } else if (lower.includes('where id = $1')) {
      rawList = rawList.filter(d => d.id === params[0]);
    } else if (lower.includes('where lower(name) = lower($1)')) {
      const name = String(params[0] || '').toLowerCase();
      rawList = rawList.filter(d => (d.name || '').toLowerCase() === name);
    } else if (lower.includes('where mobile = $1')) {
      rawList = rawList.filter(d => String(d.mobile || '') === String(params[0] || ''));
    } else if (lower.includes('where qr_code = $1')) {
      rawList = rawList.filter(d => String(d.qr_code || d.qrCode || '') === String(params[0] || ''));
    }
    const rows = rawList.map(d => ({
      ...d,
      id: d.id,
      name: d.name,
      mobile: d.mobile || '',
      email: d.email || '',
      joinDate: d.joinDate || d.join_date || '2026-01-01',
      join_date: d.joinDate || d.join_date || '2026-01-01',
      terminationDate: d.terminationDate || d.termination_date || null,
      termination_date: d.terminationDate || d.termination_date || null,
      isHidden: Boolean(d.isHidden ?? d.is_hidden ?? false),
      is_hidden: Boolean(d.isHidden ?? d.is_hidden ?? false),
      deposit: Number(d.deposit || 0),
      qrCode: d.qrCode || d.qr_code || '',
      qr_code: d.qrCode || d.qr_code || '',
      vehicle: d.vehicle || '',
      status: d.status || ((d.terminationDate || d.termination_date) ? 'Terminated' : 'Active'),
      currentShift: d.currentShift || d.current_shift || 'Day',
      current_shift: d.currentShift || d.current_shift || 'Day',
      defaultRent: Number(d.defaultRent ?? d.default_rent ?? 0),
      default_rent: Number(d.defaultRent ?? d.default_rent ?? 0),
      notes: d.notes || '',
      isManager: Boolean(d.isManager ?? d.is_manager ?? false),
      is_manager: Boolean(d.isManager ?? d.is_manager ?? false),
      foodOption: Boolean(d.foodOption ?? d.food_option ?? false),
      food_option: Boolean(d.foodOption ?? d.food_option ?? false)
    }));
    return { rows, rowCount: rows.length };
  }

  // 5. SELECT daily_entries
  if (lower.includes('from daily_entries')) {
    let rows = [...memoryStore.daily_entries];
    if (lower.includes('where')) {
      params.forEach(p => {
        if (typeof p === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p)) {
          if (lower.includes('date >=')) {
            rows = rows.filter(r => r.date >= p);
          }
        }
      });
    }
    rows.sort((a, b) => b.date.localeCompare(a.date));
    return { rows, rowCount: rows.length };
  }

  // 6. SELECT weekly_wallets
  if (lower.includes('from weekly_wallets')) {
    let rows = [...memoryStore.weekly_wallets];
    if (lower.includes('where lower(driver) = lower($1)')) {
      const driver = String(params[0] || '').toLowerCase();
      rows = rows.filter(w => (w.driver || '').toLowerCase() === driver);
    }
    return { rows, rowCount: rows.length };
  }

  // 7. SELECT driver_billings
  if (lower.includes('from driver_billings')) {
    return { rows: memoryStore.driver_billings || [], rowCount: (memoryStore.driver_billings || []).length };
  }

  // 8. SELECT leaves
  if (lower.includes('from leaves')) {
    return { rows: memoryStore.leaves || [], rowCount: (memoryStore.leaves || []).length };
  }

  // 9. SELECT shifts
  if (lower.includes('from shifts')) {
    return { rows: memoryStore.shifts || [], rowCount: (memoryStore.shifts || []).length };
  }

  // 10. SELECT expenses
  if (lower.includes('from expenses')) {
    return { rows: memoryStore.expenses || [], rowCount: (memoryStore.expenses || []).length };
  }

  // 11. SELECT company_summaries
  if (lower.includes('from company_summaries')) {
    return { rows: memoryStore.company_summaries || [], rowCount: (memoryStore.company_summaries || []).length };
  }

  // 12. SELECT admin_access
  if (lower.includes('from admin_access')) {
    return { rows: memoryStore.admin_access || [], rowCount: (memoryStore.admin_access || []).length };
  }

  // 13. SELECT manager_access
  if (lower.includes('from manager_access')) {
    return { rows: memoryStore.manager_access || [], rowCount: (memoryStore.manager_access || []).length };
  }

  // 14. INSERT INTO daily_entries
  if (lower.startsWith('insert into daily_entries')) {
    const id = params[0] || uuidv4();
    const newEntry = {
      id,
      date: params[1],
      day: params[2],
      vehicle: params[3],
      driver: params[4],
      shift: params[5],
      qr_code: params[6],
      rent: Number(params[7]) || 0,
      collection: Number(params[8]) || 0,
      fuel: Number(params[9]) || 0,
      due: Number(params[10]) || 0,
      payout: Number(params[11]) || 0,
      payout_date: params[12] || null,
      notes: params[13] || ''
    };

    const existingIdx = memoryStore.daily_entries.findIndex(e => e.id === id || (e.driver.toLowerCase() === newEntry.driver.toLowerCase() && e.date === newEntry.date));
    if (existingIdx >= 0) {
      memoryStore.daily_entries[existingIdx] = { ...memoryStore.daily_entries[existingIdx], ...newEntry };
    } else {
      memoryStore.daily_entries.unshift(newEntry);
    }
    saveStore(memoryStore);
    return { rows: [newEntry], rowCount: 1 };
  }

  // 15. INSERT INTO weekly_wallets
  if (lower.startsWith('insert into weekly_wallets')) {
    const id = params[0] || uuidv4();
    const newWallet = {
      id,
      driver: params[1],
      week_start_date: params[2],
      week_end_date: params[3],
      earnings: Number(params[4]) || 0,
      refund: Number(params[5]) || 0,
      diff: Number(params[6]) || 0,
      cash: Number(params[7]) || 0,
      charges: Number(params[8]) || 0,
      trips: Number(params[9]) || 0,
      wallet_week: Number(params[10]) || 0,
      rent_override: params[11] !== null && params[11] !== undefined ? Number(params[11]) : null,
      days_worked_override: params[12] !== null && params[12] !== undefined ? Number(params[12]) : null,
      adjustments: Number(params[13]) || 0,
      notes: params[14] || ''
    };
    const existingIdx = memoryStore.weekly_wallets.findIndex(w => w.id === id || (w.driver.toLowerCase() === newWallet.driver.toLowerCase() && w.week_start_date === newWallet.week_start_date));
    if (existingIdx >= 0) {
      memoryStore.weekly_wallets[existingIdx] = { ...memoryStore.weekly_wallets[existingIdx], ...newWallet };
    } else {
      memoryStore.weekly_wallets.unshift(newWallet);
    }
    saveStore(memoryStore);
    return { rows: [newWallet], rowCount: 1 };
  }

  // 16. INSERT INTO drivers
  if (lower.startsWith('insert into drivers')) {
    const id = params[0] || uuidv4();
    const newDriver = {
      id,
      name: params[1],
      mobile: params[2] || '',
      email: params[3] || '',
      join_date: params[4] || '2026-01-01',
      joinDate: params[4] || '2026-01-01',
      termination_date: params[5] || null,
      terminationDate: params[5] || null,
      is_hidden: Boolean(params[6]),
      isHidden: Boolean(params[6]),
      deposit: Number(params[7]) || 0,
      qr_code: params[8] || '',
      qrCode: params[8] || '',
      vehicle: params[9] || '',
      status: params[10] || 'Active',
      current_shift: params[11] || 'Day',
      currentShift: params[11] || 'Day',
      default_rent: Number(params[12]) || 0,
      defaultRent: Number(params[12]) || 0,
      notes: params[13] || '',
      is_manager: Boolean(params[14]),
      isManager: Boolean(params[14]),
      food_option: Boolean(params[15]),
      foodOption: Boolean(params[15])
    };

    const existingIdx = memoryStore.drivers.findIndex(d => d.id === id || (d.name && d.name.toLowerCase() === (newDriver.name || '').toLowerCase()));
    if (existingIdx >= 0) {
      memoryStore.drivers[existingIdx] = { ...memoryStore.drivers[existingIdx], ...newDriver };
    } else {
      memoryStore.drivers.push(newDriver);
    }
    saveStore(memoryStore);
    return { rows: [newDriver], rowCount: 1 };
  }

  // 17. UPDATE drivers
  if (lower.startsWith('update drivers')) {
    return { rows: [], rowCount: 1 };
  }

  // 18. DELETE FROM drivers
  if (lower.startsWith('delete from drivers')) {
    if (params[0]) {
      memoryStore.drivers = memoryStore.drivers.filter(d => d.id !== params[0]);
      saveStore(memoryStore);
    }
    return { rows: [], rowCount: 1 };
  }

  // 19. Default safe response for other queries
  return { rows: [], rowCount: 0 };
}

module.exports = {
  executeFallbackQuery,
  getStore: () => memoryStore
};
