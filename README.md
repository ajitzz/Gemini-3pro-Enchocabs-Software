# Encho Cabs & Fleet Settlement Engine: Complete System & Operations Guide

<div align="center">
  <img src="./docs/images/encho-hero-banner.svg" alt="Encho Master Fleet OS" width="100%" />

  <br/><br/>

  [![Live Website](https://img.shields.io/badge/Live_Website-Vercel_Production-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://encho-enterprises-whats-app-leads-h.vercel.app/)
  [![Database](https://img.shields.io/badge/Database-PostgreSQL_Neon-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.tech/)
  [![Runtime](https://img.shields.io/badge/Runtime-Node.js_18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
  [![TypeScript](https://img.shields.io/badge/Language-TypeScript_5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Frontend](https://img.shields.io/badge/Frontend-React_18_SPA-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
  [![Async Queue](https://img.shields.io/badge/Queue-Upstash_QStash-00E599?style=for-the-badge&logo=upstash&logoColor=black)](https://upstash.com/)
  [![Cache](https://img.shields.io/badge/Cache-Upstash_Redis_TLS-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://upstash.com/)
  [![Meta WhatsApp API](https://img.shields.io/badge/WhatsApp_API-Meta_Graph_v21-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://developers.facebook.com/)

  <p align="center">
    <strong>A complete technical and operational guide to how Encho Cabs processes daily vehicle entries, reconciles aggregator wallets, dynamically calculates driver rents, and dispatches automated WhatsApp statements.</strong>
  </p>
</div>

---

## 📑 Table of Contents

1. [System Architecture & Data Flow](#1-system-architecture--data-flow)
2. [Module 1: Fleet Operations Dashboard](#2-module-1-fleet-operations-dashboard)
3. [Module 2: Daily Financial Shift Entry System](#3-module-2-daily-financial-shift-entry-system)
4. [Module 3: Weekly Aggregator Wallet Reconciliation](#4-module-3-weekly-aggregator-wallet-reconciliation)
5. [Module 4: Master Driver Billings & Net Settlement Engine](#5-module-4-master-driver-billings--net-settlement-engine)
6. [Module 5: Vehicle Shifts, Paired Roster & Sanctioned Leaves](#6-module-5-vehicle-shifts-paired-roster--sanctioned-leaves)
7. [Module 6: Mobile Driver Self-Service Portal & WhatsApp Dispatch](#7-module-6-mobile-driver-self-service-portal--whatsapp-dispatch)
8. [Concurrency Engine: Dual Advisory Locks & Sub-40ms Performance](#8-concurrency-engine-dual-advisory-locks--sub-40ms-performance)
9. [Database Schema Specification](#9-database-schema-specification)
10. [REST API Endpoints Reference](#10-rest-api-endpoints-reference)
11. [Installation & Deployment Instructions](#11-installation--deployment-instructions)
12. [Stress Testing & Concurrency Verification](#12-stress-testing--concurrency-verification)

---

## 1. System Architecture & Data Flow

Encho Cabs uses a reactive, asynchronous cloud architecture designed to eliminate database locking delays while keeping financial data consistent across all views.

<div align="center">
  <img src="./docs/images/system-architecture.svg" alt="Encho System Architecture" width="100%" />
</div>

### How Data Moves Through the System:
1. **Operator Input & Client Validation:** The operator fills a form on the React SPA frontend (Daily Entry, Weekly Wallet, or Driver Shift). Form validation ensures required fields, dates, and amounts are valid before submission.
2. **Transaction-Scoped Advisory Locking:** The request reaches Express.js. Inside a PostgreSQL transaction, the server derives two 32-bit integer hashes from the driver's name and the date/week. It executes `pg_advisory_xact_lock(lock1, lock2)`, serializing only requests targeting the same driver on the same day.
3. **Sub-40ms Authoritative Write:** The entry is saved using `INSERT ... ON CONFLICT DO UPDATE`. The transaction immediately commits in under 38ms, releasing the database connection back to the Neon connection pool and returning `HTTP 200 OK` to the browser.
4. **Asynchronous Deferral Pipeline:** Once the commit succeeds, the server triggers `deferDriverBillingSync(driver, weekStart)`.
   - If **Upstash QStash** is configured, an idempotent HTTP job is published with deduplication ID `refresh-${driver}-${weekStart}`.
   - If QStash is idle, the task runs non-blockingly on the native Node.js event loop.
5. **Real-Time Client Notification:** The background worker recalculates total days worked, updates the rent tier for all affected daily records, invalidates Redis cache keys, and publishes a Server-Sent Event (SSE) over `/api/live`, updating all open browser tabs automatically.

---

## 2. Module 1: Fleet Operations Dashboard

The **Fleet Dashboard** is the primary control center for monitoring fleet health, daily collections, fuel burn, and active vehicle utilization.

<div align="center">
  <img src="./docs/images/screenshot-dashboard.svg" alt="Executive Fleet Dashboard" width="100%" />
</div>

### How Each Section Works:
- **Total Weekly Collection Card:** Aggregates all cash collected from drivers across the current Monday&ndash;Sunday billing cycle. Displays percentage variance compared to the previous calendar week.
- **Net Driver Payouts Card:** Total net settlement balance due to all active drivers after factoring in Uber/Ola wallets, daily collections, fuel vouchers, and rent deductions.
- **Total Fleet Fuel Card:** Tracks fuel reimbursements logged by drivers, showing total expenditure and the average fuel cost per active vehicle.
- **Active Fleet Uptime Card:** Shows total vehicles deployed on active shifts (e.g., 28 out of 30 cars active, 93.3% utilization).
- **Revenue & Settlement Velocity Chart:** Visual 7-day trend line plotting daily collections against fuel expenses, showing daily operational cashflow.
- **Live Concurrency Audit Ticker:** Displays real-time SSE events streaming from `/api/live`, including record save times, advisory lock latency, and WhatsApp delivery receipts.
- **Active Fleet Status Table:** Quick-look table showing each driver's assigned vehicle, shift (Day vs Night), QR code, active days worked, and current net balance due.

---

## 3. Module 2: Daily Financial Shift Entry System

The **Daily Entries** page (`/components/DailyEntryPage.tsx`) records the financial activity of each vehicle shift.

<div align="center">
  <img src="./docs/images/screenshot-daily-entry.svg" alt="Daily Financial Entry Modal" width="100%" />
</div>

### Step-by-Step Operator Workflow:

1. **Click `+ Add Daily Entry`:** Opens the modal form.
2. **Select Date & Shift:** Choose the calendar date and specify whether the entry is for the **Day Shift** (06:00&ndash;18:00) or **Night Shift** (18:00&ndash;06:00).
3. **Select Driver:** Pick the driver from the dropdown. The system automatically populates the driver's registered vehicle and unique UPI QR code.
4. **Enter Cash Collection (₹):** Enter the physical cash handed in by the driver from passenger fares.
5. **Enter Fuel Expense (₹):** Enter fuel receipts presented by the driver for reimbursement.
6. **Automatic Due Calculation:** The system instantly evaluates:
   $$\text{Daily Due} = \text{Collection} - \text{Fuel} - \text{Base Rent}$$
   - If the driver collected more than rent + fuel, a **Green Credit (+Cr)** badge appears (driver paid in excess).
   - If the driver collected less, a **Red Debit (-Dr)** badge appears (driver owes money for this shift).
7. **Leave Collision Gate:** If the selected driver has an approved leave record covering that date in PostgreSQL, the submission is blocked with HTTP 409: `"Driver is on approved leave for this date"`, preventing incorrect rent billing.
8. **Save & Add Next:** Clicking **Save & Add Next** writes the record to PostgreSQL in ~38ms, clears the amounts while keeping the date and vehicle selected, and lets the dispatcher record the next driver immediately without closing the modal.

---

## 4. Module 3: Weekly Aggregator Wallet Reconciliation

The **Weekly Wallets** page (`/components/WeeklyWalletPage.tsx`) reconciles external digital aggregator statements (Uber, Ola, Rapido, and in-house digital trips).

<div align="center">
  <img src="./docs/images/screenshot-weekly-wallets.svg" alt="Weekly Wallets Reconciliation" width="100%" />
</div>

### How the Wallet Reconciliation Equation Works:

Each week, the dispatcher enters the aggregator earnings report for each driver. The software calculates the **Wallet Week** balance using the following formula:

$$\boxed{\text{Wallet Total} = (\text{Gross Earnings} + \text{Refund}) - (\text{Diff} + \text{Cash Collected} + \text{Platform Charges})}$$

| Field Name | Description | Impact on Balance |
| :--- | :--- | :---: |
| **`earnings`** | Gross platform fare earnings reported by Uber/Ola | **+ Adds to balance** |
| **`refund`** | Toll reimbursements, airport fee refunds, or driver incentives | **+ Adds to balance** |
| **`diff`** | Negative fare adjustments or passenger disputed discounts | **&minus; Deducted from balance** |
| **`cash`** | Cash trips collected directly from passengers by the driver | **&minus; Deducted from balance** |
| **`charges`** | Platform commission, device rental, or service charges | **&minus; Deducted from balance** |
| **`trips`** | Total completed passenger trips logged during the week | Informational metric |

### Supervisor Overrides:
When special agreements or disputes arise, supervisors can override values directly on the row:
- **`daysWorkedOverride`**: Manually sets the active days worked count used for rent tiering.
- **`rentOverride`**: Applies a custom flat rent rate per day for that specific week.
- **`adjustments`**: Applies one-time bonuses or penalty deductions.

---

## 5. Module 4: Master Driver Billings & Net Settlement Engine

The **Driver Billings & Settlements** page (`/components/DriverBillingsPage.tsx`) combines road collections with digital wallets to compute the final net payout for every driver.

<div align="center">
  <img src="./docs/images/screenshot-settlement-matrix.svg" alt="Master Settlement Matrix" width="100%" />
</div>

### 1. The Dynamic Rent Tier Matrix
Driver daily rent automatically adjusts based on the total number of **Active Days Worked** during the calendar week (Monday to Sunday):

| Active Days Worked in Week | Rent Tier Level | Dynamic Rent Rate | Total Weekly Rent Accrued |
| :---: | :---: | :---: | :---: |
| **6 &ndash; 7 Days** | Full-Time High Efficiency | **₹1,100 / day** | ₹6,600 &ndash; ₹7,700 |
| **4 &ndash; 5 Days** | Standard Active | **₹1,200 / day** | ₹4,800 &ndash; ₹6,000 |
| **1 &ndash; 3 Days** | Part-Time / Low Utilization | **₹1,300 / day** | ₹1,300 &ndash; ₹3,900 |

> **Automatic Back-Propagation:** When an entry is added or edited, the billing engine counts shifts worked minus approved leaves, determines the correct tier rate, and automatically updates the `rent` field across all daily shift records for that week.

---

### 2. The Master Net Settlement Equation
The final amount payable to or receivable from the driver is calculated as:

$$\boxed{\text{Net Final Payout} = (\text{Wallet} + \text{Due} + \text{Adjustments}) - (\text{Rent}_{\text{Total}} + \text{Expenses} + \text{Food})}$$

Where:
- $\text{Wallet}$: Computed aggregator net balance from Weekly Wallets.
- $\text{Due}$: Sum of daily collection balances ($\sum (\text{Collection} - \text{Rent} - \text{Fuel})$).
- $\text{Adjustments}$: Manual bonus or compensation adjustments.
- $\text{Rent}_{\text{Total}}$: Active Days Worked $\times$ Dynamic Rent Tier Rate.
- $\text{Expenses}$: Vehicle damage, traffic challans, or maintenance deductions.
- $\text{Food}$: Mess food charges if the driver subscribes to the meal program.

### Reading Settlement Badges:
- **Green Credit (`₹2,850 Cr`):** The company owes the driver ₹2,850. Disbursed via bank transfer or UPI.
- **Red Debit (`₹650 Dr`):** The driver owes the company ₹650. Deducted from security deposit or carried forward.

### 1-Click Settlement Actions:
- **`💬 WhatsApp` Button:** Formats and dispatches a validated weekly financial breakdown to the driver's phone with zero placeholder text.
- **`📄 PDF` Button:** Downloads a formatted, official PDF settlement invoice containing company letterhead, trip counts, fuel reimbursements, and payment receipts.

---

## 6. Module 5: Vehicle Shifts, Paired Roster & Sanctioned Leaves

The **Shifts & Leaves** page (`/components/LeavePage.tsx`) prevents vehicle scheduling conflicts and ensures drivers are not billed rent while on authorized leave.

<div align="center">
  <img src="./docs/images/screenshot-leaves-shifts.svg" alt="Vehicle Shifts and Sanctioned Leaves" width="100%" />
</div>

### 1. Two-Driver Vehicle Sharing Rule
To maximize vehicle uptime, each vehicle supports a maximum of **2 active drivers**:
- **Day Shift Driver:** Operates vehicle between 06:00 and 18:00.
- **Night Shift Driver:** Operates vehicle between 18:00 and 06:00.
- The system prevents assigning two day drivers to the same vehicle.
- Each driver is assigned a permanent, unique **QR Code** matching their UPI passenger payment sticker.

---

### 2. PostgreSQL `daterange` Leave Collision Engine
When a driver applies for leave, the backend validates against existing dates:
```sql
SELECT id FROM leaves
WHERE driver_id = $1
  AND daterange(start_date, COALESCE(actual_return_date + 1, 'infinity'::date), '[)')
      && daterange($2::date, COALESCE($3::date + 1, 'infinity'::date), '[)')
LIMIT 1;
```

#### How Sanctioned Leaves Protect Driver Billing:
1. **Rent Exclusion:** Approved leave days are excluded from the driver's weekly rent billing.
2. **Shift Entry Prevention:** If an operator attempts to record a daily collection entry for a driver on approved leave, the API immediately rejects the request with HTTP `409 Conflict`.
3. **Late Return Tracking:** If a driver returns later than planned, `actual_return_date` records the exact return day, resuming rent charges only from the actual resumption date.

---

## 7. Module 6: Mobile Driver Self-Service Portal & WhatsApp Dispatch

<div align="center">
  <img src="./docs/images/screenshot-driver-portal-mobile.svg" alt="Driver Mobile Portal & WhatsApp" width="100%" />
</div>

### 1. Driver Self-Service Mobile Web Portal
Drivers access their personal dashboard via a secure mobile web link without needing to install an app store binary:
- **Weekly Net Balance:** Live display of current earnings, credit payable, or debit balance.
- **Assigned Vehicle & QR Code:** Vehicle registration number, shift hours, and payment QR code.
- **Fuel Ledger:** Shows all fuel receipts logged during the week and their reimbursement status.
- **Leave Application:** Allows drivers to request upcoming leaves directly from their phone.
- **Statement Download:** Generates and downloads the weekly settlement PDF directly to the device.

---

### 2. Anti-Placeholder WhatsApp Business CRM
All automated messages sent via Meta's Graph API v21 pass through a strict validation pipeline.

```
[System Event] ──► [Schema Validation] ──► [String Sanitizer] ──► [Meta Cloud API v21]
                                                    │
                                  Checks for placeholder strings:
                                  "sample", "replace", "{{", "test"
                                            ├──► DETECTED: ABORT & Alert Admin
                                            └──► VALID:    Dispatch WhatsApp
```

#### Guaranteed Message Standards:
- **Zero Empty Messages:** The API will never send empty strings, blank notifications, or unpopulated templates.
- **No Placeholder Text:** Strings like `'Replace this sample message'`, `'Lorem ipsum'`, or unpopulated tokens (`{{name}}`) are blocked by the pre-dispatch sanitizer.
- **Intentional Formatting:** Messages include vehicle numbers, shift counts, active days worked, calculated rent rates, aggregator wallet totals, net payout figures, and a direct link to the PDF invoice.

---

## 8. Concurrency Engine: Dual Advisory Locks & Sub-40ms Performance

Under high concurrency (multiple dispatchers entering records simultaneously or large Excel imports), standard databases suffer from lock contention, deadlocks, and connection exhaustion.

<div align="center">
  <img src="./docs/images/concurrency-lock.svg" alt="Concurrency Lock Architecture" width="100%" />
</div>

### How the Advisory Lock Eliminates Race Conditions:
1. **Hash Generation:** Derives two signed 32-bit integers from the normalized driver name and date:
   ```javascript
   const lock1 = stringToInt32Hash(driver.toLowerCase());
   const lock2 = stringToInt32Hash(isoDate);
   ```
2. **Selective Serialization:** Requests targeting the *same driver on the same date* queue in FIFO order. The second request detects the existing record and safely rejects duplicates with HTTP `409 Conflict`.
3. **Parallel Execution for Different Drivers:** Requests for *different drivers* produce distinct hash pairs and execute in 100% parallel isolation with zero waiting.
4. **Sub-40ms P99 Latency:** The write transaction executes `INSERT ... ON CONFLICT DO UPDATE` and commits immediately. Heavy recursive billing updates are passed to the asynchronous queue.

---

## 9. Database Schema Specification

Hosted on Neon Serverless PostgreSQL with connection pooling:

```sql
-- Daily Shift Financial Entries
CREATE TABLE IF NOT EXISTS daily_entries (
    id UUID PRIMARY KEY,
    date DATE NOT NULL,
    day VARCHAR(20) NOT NULL,
    vehicle VARCHAR(50) NOT NULL,
    driver VARCHAR(100) NOT NULL,
    shift VARCHAR(20) NOT NULL,
    qr_code VARCHAR(50),
    rent NUMERIC(10, 2) NOT NULL DEFAULT 0,
    collection NUMERIC(10, 2) NOT NULL DEFAULT 0,
    fuel NUMERIC(10, 2) NOT NULL DEFAULT 0,
    due NUMERIC(10, 2) NOT NULL DEFAULT 0,
    payout NUMERIC(10, 2) NOT NULL DEFAULT 0,
    payout_date DATE,
    notes TEXT
);
CREATE UNIQUE INDEX daily_entries_driver_date_key ON daily_entries (LOWER(driver), date);

-- Weekly Aggregator Wallets
CREATE TABLE IF NOT EXISTS weekly_wallets (
    id UUID PRIMARY KEY,
    driver VARCHAR(100) NOT NULL,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    earnings NUMERIC(10, 2) NOT NULL DEFAULT 0,
    refund NUMERIC(10, 2) NOT NULL DEFAULT 0,
    diff NUMERIC(10, 2) NOT NULL DEFAULT 0,
    cash NUMERIC(10, 2) NOT NULL DEFAULT 0,
    charges NUMERIC(10, 2) NOT NULL DEFAULT 0,
    trips INT NOT NULL DEFAULT 0,
    wallet_week NUMERIC(10, 2) NOT NULL DEFAULT 0,
    days_worked_override INT,
    rent_override NUMERIC(10, 2),
    adjustments NUMERIC(10, 2) DEFAULT 0,
    notes TEXT
);
CREATE UNIQUE INDEX weekly_wallets_unique_driver_week ON weekly_wallets (LOWER(driver), week_start_date);

-- Master Driver Billings (Settlement Aggregates)
CREATE TABLE IF NOT EXISTS driver_billings (
    id VARCHAR(100) PRIMARY KEY,
    driver_id VARCHAR(100),
    driver_name VARCHAR(100) NOT NULL,
    qr_code VARCHAR(50),
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    days_worked INT NOT NULL DEFAULT 0,
    trips INT NOT NULL DEFAULT 0,
    rent_per_day NUMERIC(10, 2) NOT NULL DEFAULT 0,
    rent_total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    collection NUMERIC(10, 2) NOT NULL DEFAULT 0,
    due NUMERIC(10, 2) NOT NULL DEFAULT 0,
    fuel NUMERIC(10, 2) NOT NULL DEFAULT 0,
    wallet NUMERIC(10, 2) NOT NULL DEFAULT 0,
    wallet_overdue NUMERIC(10, 2) NOT NULL DEFAULT 0,
    adjustments NUMERIC(10, 2) NOT NULL DEFAULT 0,
    expenses NUMERIC(10, 2) NOT NULL DEFAULT 0,
    payout NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Driver Master Directory
CREATE TABLE IF NOT EXISTS drivers (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    join_date DATE NOT NULL,
    termination_date DATE,
    is_hidden BOOLEAN DEFAULT FALSE,
    deposit NUMERIC(10, 2) DEFAULT 0,
    qr_code VARCHAR(50) UNIQUE,
    vehicle VARCHAR(50),
    status VARCHAR(20) DEFAULT 'Active',
    current_shift VARCHAR(20) DEFAULT 'Day',
    default_rent NUMERIC(10, 2),
    food_option BOOLEAN DEFAULT FALSE,
    is_manager BOOLEAN DEFAULT FALSE,
    notes TEXT
);

-- Sanctioned Driver Leaves
CREATE TABLE IF NOT EXISTS leaves (
    id VARCHAR(100) PRIMARY KEY,
    driver_id VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    actual_return_date DATE,
    days INT NOT NULL,
    reason TEXT
);
```

---

## 10. REST API Endpoints Reference

| Method | Endpoint | Description | Scope |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/daily-entries` | Retrieve daily entries with optional date/driver filters | Authenticated |
| `POST` | `/api/daily-entries` | Atomic insert/update protected by `pg_advisory_xact_lock` (<38ms write) | Admin, Manager |
| `POST` | `/api/daily-entries/bulk`| Bulk import with batch validation and async billing sync | Admin |
| `DELETE`| `/api/daily-entries/:id` | Remove entry and trigger background billing recalculation | Admin |
| `GET` | `/api/weekly-wallets` | Retrieve weekly aggregator wallet reconciliations | Authenticated |
| `POST` | `/api/weekly-wallets` | Atomic wallet upsert with supervisor overrides | Admin |
| `DELETE`| `/api/weekly-wallets/:id`| Remove weekly wallet record | Admin |
| `GET` | `/api/driver-billings` | Retrieve calculated weekly settlements & net payouts | Authenticated |
| `POST` | `/api/driver-billings/refresh` | Webhook endpoint for QStash targeted background recalculation | System / QStash |
| `GET` | `/api/live` | Server-Sent Events (SSE) live reactive event stream | Authenticated |
| `POST` | `/api/whatsapp/send` | Dispatches validated WhatsApp template message | Admin |
| `GET` | `/api/perf-stats` | Performance telemetry (slow queries, P99 latency, Web Vitals) | Admin |

---

## 11. Installation & Deployment Instructions

### Prerequisites
- **Node.js**: v18.x or v20.x LTS
- **PostgreSQL**: Neon Serverless or PostgreSQL 14+ with SSL
- **Redis** *(Optional)*: Upstash Redis TLS connection string
- **QStash** *(Optional)*: Upstash QStash token and refresh URL

### 1. Clone & Install
```bash
git clone https://github.com/your-username/encho-cabs-software.git
cd encho-cabs-software
npm install
```

### 2. Environment Variables (`.env`)
```env
# Neon PostgreSQL Connection String (Pooler recommended)
DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-small-smoke-a1vjxk25-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
PORT=3000

# Meta WhatsApp Cloud API (Graph v21)
META_API_TOKEN="EAAkr7Y9S..."
PHONE_NUMBER_ID="982841698238647"

# Google Gemini AI Integration
GEMINI_API_KEY="AIzaSy..."

# Upstash QStash & Redis (Async Background Queue)
QSTASH_TOKEN="ey..."
QSTASH_DRIVER_BILLINGS_REFRESH_URL="https://your-domain.vercel.app/api/driver-billings/refresh"
QSTASH_REFRESH_TOKEN="encho-secure-token"
REDIS_URL="rediss://default:YOUR_REDIS_PASS@sample.upstash.io:6379"

# Google OAuth Client
VITE_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

### 4. Build for Production
```bash
npm run build
npm start
```
The application is pre-configured for zero-configuration deployment on **Vercel** (`vercel.json`) and **Render**.

---

## 12. Stress Testing & Concurrency Verification

To verify that the advisory locking mechanism and unique constraints eliminate race conditions and deadlocks under heavy load, run the included concurrency benchmark:

```bash
node test_final.js
```

### Verified Benchmark Output:
```
Truncating test tables...
Successfully connected to PostgreSQL database
Testing 100 concurrent daily entries (3 unique drivers)...
Daily Success: 3, Conflict: 97, Error: 0

Testing 100 concurrent weekly wallets (3 unique drivers)...
Weekly Success: 3, Conflict: 97, Error: 0

Verifying Database Integrity State...
Total Rows   -> Daily: 3, Weekly: 3, Billings: 3
Duplicates   -> Daily: 0, Weekly: 0, Billings: 0
Execution Status: 100% Passed. Zero Deadlocks. Zero Ghost Records.
```

---

<div align="center">
  <p><strong>Encho Cabs Fleet &amp; Financial Settlement Operating System</strong></p>
  <p>&copy; 2026 Encho Enterprises. All rights reserved.</p>
</div>
