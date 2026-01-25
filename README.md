# CourseMaster - Course Selling Platform (Assignment 2 Part 2)

## Project Description
CourseMaster is a web application designed to connect students and instructors. This version implements a full CRUD API integrated with a PostgreSQL database.

## Team Members & Contributions
* **Ayat Balmagambet** (Group SE-2425): Database architecture, PostgreSQL integration, and CRUD API development.
* **Yernar Katyshev** (Group SE-2425): UI/UX Design, custom navigation, and README documentation.
* **Aizat Nurtay** (Group SE-2425): Frontend engineering, client-side validation, and API testing.

## Database Configuration
* **Database used:** PostgreSQL
* **Table Name:** `courses`
* **Fields:**
  - `id`: SERIAL PRIMARY KEY (Auto-incremented)
  - `title`: TEXT (Not Null)
  - `price`: NUMERIC (Not Null)
  - `description`: TEXT

## API Routes (CRUD)
The application implements the following REST-style endpoints for the `courses` entity:

| Method | Route | Description | Expected Status Code |
|--------|-------|-------------|----------------------|
| GET | `/api/courses` | Return all records sorted by ID ASC | 200 OK |
| GET | `/api/courses/:id` | Return a single record by ID | 200 OK / 404 Not Found |
| POST | `/api/courses` | Create a new record (JSON body) | 201 Created / 400 Bad Request |
| PUT | `/api/courses/:id` | Update an existing record by ID | 200 OK / 400 / 404 |
| DELETE | `/api/courses/:id` | Delete a record by ID | 200 OK / 404 Not Found |

## Server-Side Validation
* **ID Validation:** If the provided `:id` is not a valid number, the server returns a 400 status with JSON: `{ "error": "Invalid id" }`.
* **Field Validation:** Missing required fields (title, price) in POST/PUT requests trigger a 400 Bad Request response.
* **Resource Validation:** If a record is not found for GET, PUT, or DELETE, a 404 Not Found status is returned.

## 404 Handling
* **HTML Pages:** Unknown web routes return a custom `404.html` page.
* **API Routes:** Unknown API endpoints return a JSON error response.

## How to Run the Project
1. Install dependencies:
   ```bash
   npm install express pg