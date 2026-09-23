# Hierarchical Admin Management System

A web-based administrative platform built with **Node.js/Express** and **React** for managing organizational data through a geographical hierarchy with **Role-Based and Location-Based Access Control**.

---

## 🏛️ Administrative Hierarchy
```
ADMIN
  │
  ▼
STATE ADMIN (e.g. Tamil Nadu)
  │── State-level overview, all districts, divisions, and pincodes
  ▼
DISTRICT ADMIN (e.g. Salem District)
  │── District-level overview, assigned divisions and pincodes
  ▼
DIVISIONAL ADMIN (e.g. Salem North Division)
  │── Division-level overview, assigned pincodes & pincode admins
  ▼
PINCODE ADMIN (e.g. Pincode 636001)
     ── Strictly isolated to assigned Pincode (cannot view other pincodes)
```

---

## 🔑 Pre-Configured Demo Accounts

| Role | Email | Password | Assigned Location Scope |
|---|---|---|---|
| **State Admin** | `state_admin@admin.com` | `admin123` | Tamil Nadu State |
| **District Admin** | `district_admin@admin.com` | `admin123` | Salem District |
| **Divisional Admin** | `divisional_admin@admin.com` | `admin123` | Salem North Division |
| **Pincode Admin** | `pincode_admin@admin.com` | `admin123` | Pincode 636001 (Salem Fort) |
| **Pincode Admin (636002)** | `pincode_admin_636002@admin.com` | `admin123` | Pincode 636002 (Shevapet) |

---

## 🚀 Quick Start Guide

### 1. Run Backend Server
```bash
cd Backend
npm install
npm run dev
# Backend runs at http://localhost:8005
```

### 2. Run Frontend Application
```bash
cd Frontend
npm install
npm run dev
# Frontend runs at http://localhost:3000
```

---

## 💎 Features & Modules
- **Membership Cards**: Support for **Silver**, **Gold**, and **Diamond** loyalty tiers with instant discount perks, points, holographic card visuals, and tier upgrade workflow.
- **Payment Request Flow**: Multi-step payment workflow (`Pending → Approved → Paid`) for agent commission claims and vendor invoice disbursements.
- **KYC Verification**: Compliance audit queue with document inspection and 1-click approval/rejection.
- **Pincode Manager**: Zone serviceability toggle and admin allocation.
- **Orders & Service Bookings**: Real-time status management and technician assignments.
- **Strict Location Isolation**: Backend location middleware enforces data security so that Pincode Admin `636001` cannot view `636002` or `636003`.
