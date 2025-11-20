# DHL Express Internal Tracker

A Production-Ready DHL Shipment Tracking Dashboard tailored for Internal Teams.
Built with **React (Vite)**, **PHP**, and **MySQL**.

## Features

*   **Real-time Tracking**: Direct integration with DHL Unified API.
*   **Multi-AWB Dashboard**: Track unlimited shipments simultaneously.
*   **Internal Management**: Assign PICs (Person In Charge) and mark items as collected locally.
*   **Activity Logging**: Full audit trail of all actions (Add, Delete, Update, Assign).
*   **Database Storage**: Persistent MySQL storage for Shipments and Logs.
*   **Responsive**: Optimized for Desktop, Tablet, and Mobile.

---

## 🚀 Deployment Guide (Podman / Docker)

This application is containerized. It serves the React Frontend and PHP Backend from a single Apache container, linked to a MariaDB database container.

### Prerequisites
1.  **Podman** (with podman-compose) OR **Docker Desktop**.
2.  **Node.js** (to build the frontend assets).

### Step 1: Build the Frontend
The PHP container expects the compiled React assets to be present in the `dist/` folder.

```bash
# Install dependencies
npm install

# Build the project (Creates the 'dist' folder)
npm run build
```

### Step 2: Start Containers
Use Compose to orchestrate the Web Server and Database.

```bash
# Using Podman
podman-compose up --build -d

# Using Docker
docker-compose up --build -d
```

### Step 3: Access the App
Open your browser:
**http://localhost:8080**

---

## 🛠️ Manual Development (XAMPP / Local PHP)

If you want to develop locally without containers:

1.  **Database**: 
    *   Import `public/database.sql` into your MySQL/MariaDB.
    *   Create a database named `dhl_tracker`.
2.  **Backend**:
    *   Copy the `public/api` folder to your htdocs (e.g., `C:/xampp/htdocs/dhl_tracker/api`).
    *   Ensure `shipments.php` is accessible at `http://localhost/dhl_tracker/api/shipments.php`.
    *   *Note*: You may need to edit `shipments.php` to remove `getenv()` and hardcode DB credentials if not using env vars.
3.  **Frontend**:
    *   Run `npm run dev`.
    *   The app automatically detects `localhost` and tries to connect to XAMPP at `http://localhost/dhl_tracker/api/shipments.php`.

---

## 📂 Project Structure

*   **src/**: React Source Code.
*   **public/api/**: PHP Backend scripts.
*   **public/database.sql**: Database Schema.
*   **Dockerfile**: Container definition for PHP+Apache.
*   **compose.yaml**: Container orchestration config.
