# InternTrack Backend — Setup Guide

## What this is
A REST API built with **Express** and **MongoDB** that powers all four InternTrack portals:
Admin, Academic (Lecturer), Industrial (Supervisor), and Student.

---

## Prerequisites — install these first
- [Node.js](https://nodejs.org) v18 or higher
- [MongoDB Community](https://www.mongodb.com/try/download/community) **or** a free [MongoDB Atlas](https://www.mongodb.com/atlas) cloud account

---

## 1 — Install dependencies
```bash
cd interntrack-backend
npm install
```

---

## 2 — Create your .env file
Copy the example file and fill in your values:
```bash
cp .env.example .env
```

For local development the defaults work fine — you only need to change
`MONGO_URI` if you are using MongoDB Atlas.

---

## 3 — Start MongoDB locally
If you installed MongoDB Community on your computer:
```bash
# macOS / Linux
mongod --dbpath /data/db

# Windows (run in a new terminal as Administrator)
"C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath C:\data\db
```

If you prefer MongoDB Atlas, paste your Atlas connection string into
`MONGO_URI` inside `.env` and skip this step.

---

## 4 — Seed the database (test data + login accounts)
```bash
npm run seed
```

This creates sample users, companies, log entries, and grades so you can
log into every portal immediately.

---

## 5 — Start the server
```bash
# Development mode (auto-restarts when you change a file)
npm run dev

# Production mode
npm start
```

The API is now running at **http://localhost:5000**

Test it: open your browser and visit `http://localhost:5000/api/health`
You should see: `{ "status": "ok", "message": "InternTrack API is running." }`

---

## Folder Structure
```
interntrack-backend/
├── config/
│   └── db.js                  MongoDB connection
├── models/
│   ├── User.js                All portal users (admin, student, academic, industrial)
│   ├── Company.js             Partner companies + geofence coords
│   ├── PlacementRequest.js    Student self-placement submissions
│   ├── LogEntry.js            Daily student logbook entries
│   └── Grade.js               Final grades from academic supervisors
├── middleware/
│   └── auth.js                JWT verification + role checking
├── controllers/
│   ├── authController.js      Login, register, change password
│   ├── studentController.js   Student CRUD + admin actions
│   ├── companyController.js   Company CRUD
│   ├── logController.js       Submit, view, approve/reject logs
│   ├── placementController.js Placement request flow
│   └── gradeController.js     Submit and retrieve grades
├── routes/
│   ├── auth.js
│   ├── students.js
│   ├── companies.js
│   ├── logs.js
│   ├── placements.js
│   └── grades.js
├── server.js                  Entry point — starts Express
├── seed.js                    Populates DB with test data
├── package.json
└── .env.example
```

---

## Full API Reference

### Authentication
| Method | URL | Who | Description |
|--------|-----|-----|-------------|
| POST | /api/auth/login | Anyone | Log in, receive JWT |
| POST | /api/auth/register | Admin | Create a new user account |
| GET | /api/auth/me | Logged in | Get current user profile |
| POST | /api/auth/change-password | Logged in | Change own password |

### Students
| Method | URL | Who | Description |
|--------|-----|-----|-------------|
| GET | /api/students | Admin/Academic/Industrial | List students (filtered by role) |
| GET | /api/students/:id | Admin/Academic | Full profile + grade |
| PUT | /api/students/:id/assign | Admin | Assign company + supervisors |
| POST | /api/students/:id/reset-password | Admin | Generate temp password |
| PUT | /api/students/:id/revoke | Admin | Revoke placement |
| DELETE | /api/students/:id | Admin | Delete record |

### Companies
| Method | URL | Who | Description |
|--------|-----|-----|-------------|
| GET | /api/companies | All | List active companies + slots |
| GET | /api/companies/:id | All | Single company detail |
| POST | /api/companies | Admin | Register new partner |
| PUT | /api/companies/:id | Admin | Update slots / details |
| DELETE | /api/companies/:id | Admin | Deactivate company |

### Log Entries
| Method | URL | Who | Description |
|--------|-----|-----|-------------|
| POST | /api/logs | Student | Submit daily log |
| GET | /api/logs/me | Student | Own log history (grouped by week) |
| GET | /api/logs/pending | Industrial | Pending logs for their interns |
| PUT | /api/logs/:id/approve | Industrial | Approve a log |
| PUT | /api/logs/:id/reject | Industrial | Reject a log |
| GET | /api/logs/student/:id | Academic/Admin | View any student's logs |

### Placements
| Method | URL | Who | Description |
|--------|-----|-----|-------------|
| POST | /api/placements | Student | Report self-placement |
| GET | /api/placements | Admin | View pending queue |
| PUT | /api/placements/:id/approve | Admin | Approve + activate student |
| PUT | /api/placements/:id/decline | Admin | Decline request |

### Grades
| Method | URL | Who | Description |
|--------|-----|-----|-------------|
| POST | /api/grades | Academic | Submit/update a grade |
| GET | /api/grades/student/:id | Academic/Admin | Get one student's grade |
| GET | /api/grades | Admin | Full grade registry |

---

## How authentication works

1. Your React app calls `POST /api/auth/login` with `{ email, password }`
2. The server returns a `token` string
3. Store it: `localStorage.setItem('token', token)`
4. Send it with every future request in the `Authorization` header:
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
   ```

---

## Connecting your React frontend

In your React components, replace `TODO` fetch comments like this:

```js
// Example: submit a daily log from LogEntryForm.js
const token = localStorage.getItem('token');

const response = await fetch('http://localhost:5000/api/logs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    weekNumber: 4,
    day: 'Monday',
    date: 'Mar 10',
    activity: entry,
    skills: skills,
    locationVerified: isLocationVerified,
  }),
});

const data = await response.json();
```
