# DHL Express Internal Tracker

A Production-Ready DHL Shipment Tracking Dashboard.
Built with **React**, **PHP**, and **MySQL**, fully containerized with **Docker**.

## 🚀 How to Deploy (Docker)

This is the easiest way to run the application. It sets up the Frontend, Backend, and Database automatically.

### Prerequisites
*   **Docker** and **Docker Compose** installed on your machine.

### Steps

1.  **Clone/Open Project**:
    Open your terminal in the project folder.

2.  **Run Docker Compose**:
    This command will build the React app, create the PHP server, and start the Database.
    ```bash
    docker-compose up --build -d
    ```

3.  **Access the App**:
    Wait about 30 seconds for the database to initialize.
    Open your browser and go to:
    👉 **http://localhost:8080**

---

### 📂 Project Architecture

*   **Container 1 (app)**: 
    *   **OS**: Linux (Debian/Alpine)
    *   **Web Server**: Apache
    *   **Runtime**: PHP 8.2
    *   **Content**: Serves the compiled React App (`index.html`) and the API (`api/shipments.php`).
*   **Container 2 (db)**:
    *   **Database**: MariaDB 10.6
    *   **Storage**: Persistent Docker Volume (`db_data`).

### 🛠️ Troubleshooting

*   **App is Loading Indefinitely?**
    *   Check if the containers are running: `docker ps`
    *   Check logs: `docker logs dhl-tracker-app`
*   **Database Error?**
    *   The database takes a moment to start up properly on the very first run. Wait a minute and refresh.

### 💻 Development (Localhost without Docker)

If you want to modify the code:

1.  **Install Dependencies**: `npm install`
2.  **Run Dev Server**: `npm run dev`
3.  **Backend**: You will need a local XAMPP/MAMP server running MySQL and PHP to handle the API requests, as the React dev server acts only as a frontend proxy.
