# 🌐 AidLedger: Decentralized Conditional Cash Transfer & Foreign Aid Tracking

> **Empowering Beneficiaries, Eliminating Corruption, and Automating Trustworthy Payouts via Full-Stack Enterprise Blockchain Integration.**

---

## 📖 Executive Summary

**AidLedger** is an enterprise-grade decentralized platform designed to overhaul traditional foreign aid delivery and welfare cash distribution systems. Trillions of dollars in foreign aid and humanitarian subsidies often face transparency deficits, administrative bottlenecks, and misappropriation risk. 

AidLedger bridges the ultimate gap between central monetary authorities (such as the State Bank), intermediary banks, external auditing agencies, certified POS vendors, and grassroots beneficiaries. By running business logic natively on an immutable local **Hyperledger Besu (Quorum)** network powered by highly secure custom Solidity Smart Contracts, AidLedger ensures **conditional cash transfers (CCT)** are executed precisely when verified milestones are achieved—guaranteeing end-to-end trace auditing with zero administrative overhead.

---

## ✨ Premium Highlights & Features

* 🔐 **Decentralized RBAC Governance**: Strict segregation of duties enforcing custom authorization protocols across distinct ecosystem personas (Beneficiaries, Bank Personnel, Third-Party Auditors, and SBP Administrators). One role cannot execute or mutate the core state parameters of another.
* ⚡ **Lightweight Python MVC Architecture**: Seamless integration using a modular Python Flask application powered by **Prisma ORM** for real-time relational persistence, paired with **HTMX** for dynamic, SPA-like frontend speed without heavy frontend bundles.
* ⛓️ **Consensus-Driven Audit Trails**: Native connection to local Besu Quorum nodes running EVM smart contracts (`AidLedgerGov.sol`, `AidRegistry.sol`) allowing immediate transparent verification on custom network dashboards and block explorers.
* 📱 **Real-Time Live SMS Validation**: Fully integrated two-factor authentication loop leveraging Twilio OTP SMS microservices to instantly verify user registration events and authorize merchant payouts directly at POS terminals.
* 🏪 **Merchant POS Platform**: Distinct web portal dedicated entirely to verified local vendors/merchants (`vendor_app.py`), allowing seamless redemption of conditional aid tokens for transparent inventory receipts.
* 📊 **Targeted UI Viewports**: Advanced contextual privacy where complex under-the-hood blockchain consensus graphs are shielded from standard users, presenting specific macro-metrics explicitly to banking overseers and regulatory auditors.

---

## 🏗️ System Architecture & Layered Stack

```
   ┌─────────────────────────────────────────────────────────┐
   │             PRESENTATION & VIEWPORT LAYER               │
   │   Jinja2 Templates  │  Modern Sleek CSS  │  HTMX Sync   │
   └────────────────────────────┬────────────────────────────┘
                                │
   ┌────────────────────────────▼────────────────────────────┐
   │             APPLICATION LAYER (Flask MVC)               │
   │  Controllers  │  Middleware Auth  │  Services micro-api │
   └────────────────────────────┬────────────────────────────┘
                                │
   ┌────────────────────────────▼────────────────────────────┐
   │             PERSISTENCE & NOTIFICATION LAYER            │
   │     Python Prisma ORM Engine  │  Twilio SMS Gateway     │
   └────────────────────────────┬────────────────────────────┘
                                │
   ┌────────────────────────────▼────────────────────────────┐
   │             IMMUTABLE CONSENSUS LAYER (EVM)             │
   │  Hyperledger Besu Nodes  │  AidLedgerGov Smart Contract │
   └─────────────────────────────────────────────────────────┘
```

### 🛠️ Core Technology Components

1. **Smart Contracts Layer**: Written in modern **Solidity** to govern token balance structures, verification registry criteria, customizable policy criteria rules, and multi-signature release hooks.
2. **Backend Framework**: Built on **Python Flask** for maximum execution performance and developer agility, organized cleanly into controllers, routes, and background transactional services.
3. **Database Relational Mapping**: Driven by **Python-Prisma Client** communicating seamlessly with localized containerized **PostgreSQL** storage (`Data/appdb_backup.sql`).
4. **Blockchain Infrastructure**: Containerized network comprising parallel **Hyperledger Besu** validators, companion block explorers (`Blockscout`), and localized telemetry collectors (`Prometheus`/`Grafana`).

---

## 📂 Repository Layout Map

```text
├── AidLedger/                  # Main Python Flask Full-Stack Architecture
│   ├── app/                    # Core Application Engine
│   │   ├── controllers/        # Route Handlers and Business Operations
│   │   ├── middleware/         # Security Hooks and RBAC Session Validation
│   │   ├── models/             # Schema Logic and Database Hooks
│   │   ├── routes/             # Blueprint Registrations
│   │   ├── services/           # External APIs (Blockchain EVM, Twilio OTP)
│   │   ├── static/             # Vanilla Premium CSS and HTMX Utility Scripts
│   │   └── templates/          # Contextual Jinja2 Viewports (Admin, Audit, SBP, Vendor)
│   ├── prisma/                 # Relational Database Schema & Client Generator
│   ├── run.py                  # Primary Administrator & Auditor Portal Server
│   └── vendor_app.py           # Specialized Merchant POS Management Server
├── Besu/                       # Private Permissioned Quorum Network Engine
│   └── quorum-test-network/    # Multi-Validator Deployment Configuration
├── Data/                       # Local Environment Database Backups
│   └── appdb_backup.sql        # Live Initialized PostgreSQL Database Snapshots
└── Documentation/              # Official Project Reports and Academic Deliverables
```

---

## 👥 Targeted Personas & Viewports

### 🧑‍🌾 1. Beneficiary View
Focused pure user workflow showing active aid entitlement caps, applicable policy thresholds, and real-time status pipelines without cognitive overload from backend blockchain hashing layers.

### 🏛️ 2. Central Authority (SBP) & Bank Portal
Premium analytics interfaces tracking regional funding allocation graphs, live transaction confirmation speeds, contract owner operations, and overall city-wide disbursement progress reports.

### 🕵️‍♂️ 3. Auditing Personnel Dashboard
Real-time regulatory monitor capable of cross-referencing relational SQL databases directly against low-level immutable ledger states to guarantee exact policy adherence and trace audit logs instantly.

### 🏪 4. Verified POS Merchant
Streamlined Point-of-Sale interface validating external user SMS OTP tokens to redeem basic conditional aid allocations into local tangible goods instantly.

---

## 🚀 Local Development Setup Guide

### Prerequisites
* **Docker Desktop** running locally (for Besu network configuration and Postgres container hosting).
* **Python 3.10+** installed natively.

### Step 1: Initialize the Enterprise Database
Restore the complete application database state directly from our preserved database snapshot:
```bash
# Verify app-postgres container is operational via docker-compose up inside Besu environment
docker exec -i app-postgres psql -U appuser -d appdb < Data/appdb_backup.sql
```

### Step 2: Configure the Python Application Environment
Navigate into the core server directory and prepare standard virtual environments:
```bash
cd AidLedger
python -m venv venv

# Activate Virtual Environment (Windows)
.\venv\Scripts\activate

# Install Core Package Dependencies
pip install -r requirements.txt

# Synchronize and Generate Local Prisma Client Hooks
prisma generate
```

### Step 3: Launch Local Web Servers
AidLedger operates distinct optimized server instances supporting separate enterprise workflows:

**Launch Core Regulatory & User Dashboard Portal:**
```bash
python run.py
# Running securely at http://localhost:5000
```

**Launch Specialized POS Vendor Portal Engine:**
```bash
python vendor_app.py
# Running securely at http://localhost:5001
```

---

## 📜 Academic Integrity & Contributions

Developed as a definitive capstone project solution addressing structural socio-economic governance challenges. All related documents, defense slide decks, and milestone architectural blueprints are publicly available in the **`Documentation/`** parent repository.

---

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.

---

**AidLedger** — Enterprise Blockchain Integration for Transparent Humanitarian Aid Allocation.
