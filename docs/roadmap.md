# Roadmap

Web first. The mobile app comes after doctors have used the web version and given feedback.

## Phase 0: foundation (done)
- Monorepo: `frontend`, `backend`, `shared`, CI
- Database design for queue, visits, prescriptions, payments, treatment plans, messages, audit
- Encryption for medical data, English/Urdu routing, live public queue on the patient page

## Phase 1: clinic can run a day
1. Staff login (phone + password), roles, protect staff pages and socket rooms
2. Management desk: add walk-in and emergency, arrivals, no-show, skip, call, clinic status, time per patient
3. Doctor's room: current patient, view-only history, quick notes, medicines, Done → next patient
4. Live updates on every screen

## Phase 2: patients at home
5. Patient sign-in with phone OTP
6. Online booking with expected time, "patients before you", "I'm at the clinic"
7. Messages: booking confirmed, 3 patients before you, your turn (WhatsApp + SMS)

## Phase 3: money and prescriptions
8. Fees, discounts with reasons, cash/card collection, refunds
9. Finance: today, cash in drawer, payments list, last 7 days
10. One-page printable prescription, share on WhatsApp
11. Online payment (JazzCash / Easypaisa / card gateway)

## Phase 4: long-term treatment
12. Treatment plans, daily reminder job, missed-visit list for management

## Phase 5: first doctor live
13. Deployment script for a new doctor, backups, monitoring
14. Pilot with 2–3 doctors, collect feedback

## Later
- Mobile app (React Native / Expo) reusing `shared`
- A clinic with several doctors in one copy
