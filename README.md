# BiblioTech &mdash; Library Management & Book Lending System

A production-ready, secure, and robust server-rendered **Library Management and Book Lending System** built with **Node.js**, **Express.js**, **EJS**, and **MongoDB / Mongoose**.

---

## 1. Project Overview

BiblioTech provides an end-to-end digital circulation desk and catalog management system for public and educational libraries. It enables library members to discover and request books, track their active loans, review borrowing history, and monitor overdue fines. Librarians can manage book inventory, process borrow requests, issue books directly, process returns with automatic fine calculation, monitor circulation analytics, and view member accounts.

---

## 2. Key Features

### For Members
* **Self-Service Registration & Secure Login**: Sign up as a library member with session-based authentication and password encryption.
* **Catalog Discovery**: Search across titles, authors, and ISBNs; filter by category and real-time availability with server-side pagination.
* **Book Issue Requests**: Submit borrow requests with immediate feedback on stock availability and pending status.
* **Active Loans Tracking**: View currently borrowed books, issuance dates, due dates, overdue statuses, and accrued daily fines.
* **Member Dashboard**: High-level metrics showing active loans, pending requests, overdue books, and books due soon.
* **Borrowing History**: Comprehensive log of previously borrowed books, return dates, and assessed fines.

### For Librarians / Admins
* **Librarian Analytics Dashboard**: Key circulation indicators (titles count, physical copies, available copies, issued copies, overdue books, pending requests, member count, total fines).
* **Most-Borrowed Books**: Popularity algorithm calculated from historical loan records (both active and returned loans).
* **Inventory Management (CRUD)**: Add, edit, and safely archive books. Automatically ensures total copies cannot be reduced below the number of currently issued copies.
* **Request Processing**: Review pending member requests, approve and atomically decrement available copies, or reject with custom feedback.
* **Direct Book Lending**: Directly issue in-stock books to registered members with automatic due date calculation (14 days).
* **Book Returns & Fine Assessment**: One-click return processing with double-return protection, atomic inventory increment, and fine calculation ($5.00/day overdue).
* **Member Directory**: Monitor all registered members and their active borrowing count.

---

## 3. Technology Stack

* **Frontend**: EJS (Embedded JavaScript Templates), Bootstrap 5, Bootstrap Icons, Custom CSS3, Vanilla JS.
* **Backend**: Node.js (v20+ / v26 compatible), Express.js (Modular MVC architecture).
* **Database**: MongoDB Atlas / Local MongoDB, Mongoose ODM.
* **Authentication & Session**: `express-session`, `connect-mongo` (persistent MongoDB session store), `bcryptjs`.
* **Security Middleware**: `helmet` (with tailored CSP directives for CDN styles/scripts), session-based CSRF protection, method-override.
* **Testing Framework**: `jest`, `supertest`.

---

## 4. Architecture

```text
Browser / Client
      │  HTTP Requests (Cookies, Form Data, CSRF Token)
      ▼
Express Application (app.js)
      │
      ├─ Security Middleware (helmet, urlencoded, session, csrfProtection, viewLocals)
      │
      ├─ Route Layer (routes/)
      │    ├─ authRoutes.js
      │    ├─ bookRoutes.js
      │    ├─ memberRoutes.js (requireAuth + requireMember)
      │    └─ librarianRoutes.js (requireAuth + requireLibrarian)
      │
      ├─ Controllers (controllers/)
      │    ├─ authController.js
      │    ├─ bookController.js
      │    ├─ requestController.js
      │    ├─ loanController.js
      │    └─ dashboardController.js
      │
      ├─ Services & Business Logic (services/)
      │    ├─ bookService.js
      │    ├─ loanService.js
      │    └─ dashboardService.js
      │
      ├─ Utilities (utils/)
      │    └─ fineCalculator.js
      │
      ├─ Data Models (models/)
      │    ├─ User.js
      │    ├─ Book.js
      │    ├─ Loan.js
      │    └─ Request.js
      │
      └─ Database (MongoDB / MongoDB Atlas via Mongoose)

Views Rendering:
Controller ──> EJS Template (views/) ──> HTML Document ──> Browser
```

---

## 5. Folder Structure

```text
library-management/
├── app.js                      # Express application setup and middleware pipeline
├── server.js                   # Server entrypoint and graceful shutdown
├── package.json                # Project dependencies and npm scripts
├── seed.js                     # Seed script with sample members, admin, and books
├── .env                        # Local environment configuration
├── .env.example                # Environment variables template
├── .gitignore                  # Git ignore definitions
├── README.md                   # System documentation
│
├── config/
│   ├── constants.js            # Business constants, roles, and statuses
│   ├── db.js                   # Mongoose connection manager
│   └── session.js              # Session configuration with MongoStore
│
├── models/
│   ├── User.js                 # User schema, password hashing, and roles
│   ├── Book.js                 # Book schema, copy invariants, and indexes
│   ├── Request.js              # Book issue requests schema
│   └── Loan.js                 # Active and historical loans schema
│
├── controllers/
│   ├── authController.js       # Register, login, session regeneration, logout
│   ├── bookController.js       # Catalog browsing, inventory CRUD, archiving
│   ├── requestController.js    # Member requests and librarian approvals/rejections
│   ├── loanController.js       # Active loans, history, returns, direct issue
│   └── dashboardController.js  # Member and librarian analytics dashboards
│
├── services/
│   ├── bookService.js          # Book business rules, search/filter, inventory updates
│   ├── loanService.js          # Concurrency-safe issues, returns, borrowing limits
│   └── dashboardService.js     # Analytics and historical loan aggregations
│
├── validators/
│   ├── authValidator.js        # Registration/login input validation and sanitization
│   └── bookValidator.js        # Book input validation and copy limits
│
├── middleware/
│   ├── auth.js                 # requireAuth and redirectIfAuth middleware
│   ├── role.js                 # requireLibrarian and requireMember (403 Forbidden)
│   ├── csrf.js                 # Session-based CSRF token generation and validation
│   ├── viewLocals.js           # Exposes user, app info, and flash alerts to views
│   └── errorHandler.js         # Centralized error and 404 handlers
│
├── utils/
│   └── fineCalculator.js       # Date normalization, overdue days, and fine calculator
│
├── views/
│   ├── partials/
│   │   ├── header.ejs          # HTML head, Bootstrap 5 CDN, and navbar include
│   │   ├── navbar.ejs          # Dynamic responsive navigation bar
│   │   ├── alerts.ejs          # Flash success and error alerts
│   │   ├── pagination.ejs      # Reusable pagination widget
│   │   └── footer.ejs          # Footer and script includes
│   ├── auth/
│   │   ├── login.ejs           # Sign in page
│   │   └── register.ejs        # Member registration page
│   ├── books/
│   │   ├── index.ejs           # Public & member book catalog
│   │   └── detail.ejs          # Single book detail and request action
│   ├── member/
│   │   ├── dashboard.ejs       # Member statistics and active loans
│   │   ├── loans.ejs           # Active borrowed books and accrued fines
│   │   ├── requests.ejs        # Request history and statuses
│   │   ├── history.ejs         # Returned loans archive
│   │   └── profile.ejs         # User profile and account details
│   ├── librarian/
│   │   ├── dashboard.ejs       # Librarian operational analytics and top titles
│   │   ├── books/
│   │   │   ├── index.ejs       # Inventory table and archive actions
│   │   │   ├── new.ejs         # Add new title form
│   │   │   └── edit.ejs        # Update title and inventory form
│   │   ├── requests/
│   │   │   └── index.ejs       # Review and approve/reject requests
│   │   ├── loans/
│   │   │   ├── index.ejs       # Circulating loans and return processing
│   │   │   └── issue.ejs       # Direct issue form
│   │   └── members/
│   │       └── index.ejs       # Member accounts overview
│   └── errors/
│       ├── 400.ejs             # Bad request page
│       ├── 403.ejs             # Access forbidden page
│       ├── 404.ejs             # Page not found
│       └── 500.ejs             # Internal server error
│
├── public/
│   ├── css/
│   │   └── custom.css          # Design system styling, status badges, cards
│   └── js/
│       └── main.js             # Client enhancements, confirmation prompts, alerts
│
└── tests/
    ├── testHelper.js           # Test DB runner and authenticated agent factory
    ├── auth.test.js            # Registration, hashing, login, logout tests
    ├── authorization.test.js   # RBAC, 403 enforcement, role tampering tests
    ├── books.test.js           # Catalog CRUD, search, filter, archive tests
    ├── inventory_and_lending.test.js # Edge cases 1, 2, 3, 4, 6, 7, 8, 10 tests
    ├── fines.test.js           # Overdue calculations and historical aggregations
    └── e2e.test.js             # 21-step Section 59 end-to-end integration test
```

---

## 6. Installation & Setup

### Prerequisites
* **Node.js**: v18.x, v20.x, or v26.x
* **MongoDB**: Local MongoDB daemon (`localhost:27017`) or MongoDB Atlas URI

### 1. Clone & Install Dependencies
```bash
cd /path/to/project
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Review and adjust variables:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/library_management
SESSION_SECRET=super_secret_library_session_key_change_in_production_32chars
MAX_ACTIVE_LOANS=5
LOAN_DURATION_DAYS=14
FINE_PER_DAY=5
SEED_LIBRARIAN_EMAIL=admin@example.com
SEED_LIBRARIAN_PASSWORD=Admin@123
```

---

## 7. MongoDB Atlas Setup

To connect to a cloud MongoDB Atlas instance:
1. Create a free cluster on [MongoDB Atlas](https://cloud.mongodb.com/).
2. Under **Database Access**, create a user with read/write privileges.
3. Under **Network Access**, add your IP address (or `0.0.0.0/0` for cloud deployment).
4. Retrieve your connection string from the **Connect** modal (e.g. `mongodb+srv://<user>:<password>@cluster0.mongodb.net/library_management?retryWrites=true&w=majority`).
5. Update `MONGODB_URI` in `.env`:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/library_management?retryWrites=true&w=majority
   ```

---

## 8. Seed Data

Populate the database with sample books, members, active/overdue loans, and requests:
```bash
npm run seed
```

### Default Seed Credentials
* **Librarian Account**:
  * **Email**: `admin@example.com`
  * **Password**: `Admin@123`
* **Sample Member Account**:
  * **Email**: `alice@example.com`
  * **Password**: `Member@123`

---

## 9. Running the Application

### Development Mode (with hot-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

Access the application in your browser:
```text
http://localhost:3000
```

---

## 10. User Roles & Permissions

| Action / Capability | Member | Librarian |
| :--- | :---: | :---: |
| Register as Member | Yes | No |
| Login / Logout | Yes | Yes |
| View Catalog & Book Details | Yes | Yes |
| Search & Filter Books | Yes | Yes |
| Request a Book | Yes | No |
| View Personal Requests & Loans | Yes | No |
| View Personal Borrowing History | Yes | No |
| View Librarian Operational Dashboard | No (403) | Yes |
| Create & Edit Books | No (403) | Yes |
| Safely Archive / Restore Books | No (403) | Yes |
| Approve / Reject Book Requests | No (403) | Yes |
| Directly Issue Books to Members | No (403) | Yes |
| Process Book Returns & Assess Fines | No (403) | Yes |
| View Registered Members Directory | No (403) | Yes |

---

## 11. Business Rules & Edge Cases

The system enforces strict invariants across inventory and circulation:

1. **Inventory Invariant**: At all times, `0 <= availableCopies <= totalCopies`.
2. **Edge Case 1 (Last Copy)**: When `availableCopies = 1`, issuing decrements it to `0`. Any subsequent issue attempt is rejected immediately with clear messaging.
3. **Edge Case 2 (Borrowing Limit)**: A member can hold a maximum of `MAX_ACTIVE_LOANS` (default: 5) active loans. Attempting to request or issue a 6th book is rejected.
4. **Edge Case 3 (Duplicate Book)**: A member cannot request or borrow a second copy of a book they currently hold on active loan.
5. **Edge Case 4 (Double Return Protection)**: Once a loan is marked `RETURNED` (`returnedAt !== null`), another return attempt fails safely. Inventory is never incremented twice.
6. **Edge Case 5 (Negative Copies)**: Creating or updating books with `totalCopies < 0` is rejected by schema and controller validators.
7. **Edge Case 6 (Inventory Increase)**: If a book has `totalCopies = 10` and `availableCopies = 6` (4 issued), updating total to `12` automatically updates available copies to `8` (`12 - 4`), preserving the 4 issued copies.
8. **Edge Case 7 (Lower Total Inventory)**: If 4 copies are currently issued, attempting to reduce total copies to `2` is rejected because total physical copies cannot become lower than the number of copies currently out on loan.
9. **Edge Case 8 (Concurrency & Simultaneous Issue)**: Uses MongoDB atomic conditions (`findOneAndUpdate({ _id: id, availableCopies: { $gt: 0 } }, { $inc: { availableCopies: -1 } })`) to prevent race conditions when two users/librarians simultaneously request the last copy.
10. **Edge Case 9 (Role Escalation Protection)**: Any `role` submitted during user registration is ignored; the server strictly assigns `MEMBER`. Member cannot access admin operations.
11. **Edge Case 10 (Invalid Request Approval)**: A librarian cannot approve a request that was already rejected or processed; no loan is created and inventory is protected.
12. **Automatic Fine Calculation**:
   $$\text{overdueDays} = \max(0, \lceil \frac{\text{returnDate} - \text{dueDate}}{24 \times 60 \times 60 \times 1000} \rceil)$$
   $$\text{fine} = \text{overdueDays} \times \text{FINE\_PER\_DAY}\;(\$5.00/\text{day})$$
13. **Most-Borrowed Books Calculation**: Popularity is calculated from all historical loan records (both active and returned loans), avoiding bias towards only currently active loans.

---

## 12. Application Routes

### Public & Authentication Routes
* `GET  /` &rarr; Redirects to `/books`
* `GET  /books` &rarr; Browse catalog with search, category, and availability filters
* `GET  /books/:id` &rarr; Book details and request action
* `GET  /login` &rarr; Sign in form
* `POST /login` &rarr; Authenticate credentials and regenerate session
* `GET  /register` &rarr; Member registration form
* `POST /register` &rarr; Create member account
* `POST /logout` &rarr; Terminate session and clear cookie

### Member Routes (Protected by `requireAuth` + `requireMember`)
* `GET  /member/dashboard` &rarr; Member dashboard and quick metrics
* `GET  /member/profile` &rarr; Member profile and account metadata
* `GET  /member/requests` &rarr; List personal book requests
* `POST /member/books/:id/request` &rarr; Submit a new book issue request
* `GET  /member/loans` &rarr; Active loans with due dates and accrued fines
* `GET  /member/history` &rarr; Historical returned loans and paid fines

### Librarian Routes (Protected by `requireAuth` + `requireLibrarian`)
* `GET  /librarian/dashboard` &rarr; Circulation analytics, top books, and overdue alerts
* `GET  /librarian/books` &rarr; Inventory table with active/archived filters
* `GET  /librarian/books/new` &rarr; New book creation form
* `POST /librarian/books` &rarr; Create new book
* `GET  /librarian/books/:id/edit` &rarr; Edit book details and inventory
* `POST /librarian/books/:id/update` &rarr; Save inventory updates with copy consistency
* `POST /librarian/books/:id/archive` &rarr; Safely archive book
* `POST /librarian/books/:id/restore` &rarr; Reactivate archived book
* `GET  /librarian/requests` &rarr; Manage pending member issue requests
* `POST /librarian/requests/:id/approve` &rarr; Approve request and issue copy
* `POST /librarian/requests/:id/reject` &rarr; Reject request with reason
* `GET  /librarian/loans` &rarr; Manage active, overdue, and returned loans
* `GET  /librarian/loans/issue` &rarr; Direct issue form
* `POST /librarian/loans/issue` &rarr; Process direct issue
* `POST /librarian/loans/:id/return` &rarr; Process book return and assess fine
* `GET  /librarian/members` &rarr; View registered members and active borrowing counts

---

## 13. Automated Test Suite

The test suite provides comprehensive coverage of all authentication, authorization, inventory safety invariants, concurrency, lending workflows, fines, and end-to-end integration workflows.

### Run All Tests
```bash
npm test
```

### Test Files Breakdown
* **`tests/auth.test.js`**: User registration, password hashing verification, duplicate email rejection, login authentication, invalid credential rejection, logout, and protected route redirection.
* **`tests/authorization.test.js`**: Role-based access control, server-side 403 Forbidden enforcement on librarian routes, and privilege escalation tampering prevention.
* **`tests/books.test.js`**: Book creation, duplicate ISBN prevention, negative copies rejection, catalog searches, category/availability filtering, and safe archival.
* **`tests/inventory_and_lending.test.js`**: Edge cases 1 (last copy), 2 (borrowing limit), 3 (duplicate loan), 4 (double return protection), 6 (inventory adjustment), 7 (lower total copies constraint), 8 (concurrency race condition on last copy), and 10 (invalid request approval).
* **`tests/fines.test.js`**: Due date validation, on-time returns ($0 fine), 1-day overdue ($5 fine), multi-day overdue calculation, active accrued fine calculation, and historical popularity aggregations.
* **`tests/e2e.test.js`**: Complete 21-step Section 59 end-to-end integration test simulating the entire user lifecycle.

---

## 14. Security Considerations

* **Password Security**: Passwords are encrypted with `bcryptjs` using a salt work factor of 10. Raw passwords are never stored in memory or logged.
* **Session Security**: Session cookies configured with `httpOnly: true`, `sameSite: 'lax'`, `maxAge: 24h`, and `secure: true` in production.
* **Session Fixation Defense**: Sessions are regenerated upon every login and registration.
* **Cross-Site Request Forgery (CSRF)**: All state-changing requests (`POST`, `PUT`, `DELETE`) require a valid session CSRF token via `middleware/csrf.js`.
* **Privilege Escalation Prevention**: Role values are strictly controlled; client-submitted role fields during registration or profile updates are stripped.
* **HTTP Security Headers**: Powered by `helmet`, establishing Content Security Policy (CSP), frame protection (`X-Frame-Options: SAMEORIGIN`), and MIME-type sniffing prevention.
* **Data Sanitization**: Regex inputs are sanitized before query execution to avoid regular expression denial of service (ReDoS).
* **Error Handling**: Centralized error middleware ensures internal stack traces and server internals are suppressed in production.

---

## 15. License & Author

* **License**: ISC
* **Application**: BiblioTech Library Management System
