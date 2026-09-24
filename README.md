# KIET Smart Queue – A Real-Time Digital Campus Queue Management System

A real-time digital queue management system designed to help students, staff, administrators, and guests manage campus service queues efficiently.

## 🚀 Live Deployment

[KIET Smart Queue | Smart Queue Management](https://kietsmartqueue.netlify.app/)

## 📌 Project Overview

KIET Smart Queue provides a centralized platform for joining, monitoring, and managing campus service queues.

### Key Features

- Real-time queue position and ETA
- Live queue updates using Socket.IO
- Student, Staff, Admin and Guest roles
- QR-based guest queue access
- Queue hold and resume
- Emergency priority requests
- Staff queue management
- Notifications
- Analytics and dashboards
- AI-powered chatbot

## 🖼️ Project Screenshots

Store screenshots inside `docs/images/`.

![Student Dashboard](docs/images/student-dashboard.png)

![Queue Tracking](docs/images/queue-tracking.png)

![Staff Dashboard](docs/images/staff-dashboard.png)

![Admin Dashboard](docs/images/admin-dashboard.png)

![Guest QR](docs/images/guest-qr.png)

![AI Chatbot](docs/images/ai-chatbot.png)

## 🛠️ Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React.js, Tailwind CSS, Framer Motion, Recharts, Lucide Icons |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Real-Time | Socket.IO |
| Notifications | Web Push |
| File Uploads | Multer |
| AI Service | Python, FastAPI, Ollama, TinyLlama |
| Server | Uvicorn |
| Version Control | GitHub |

## 🔄 System Workflow

User → Login / Guest QR → Select Service → Join Queue → Real-Time Tracking → Staff Processing → Service Completed

## 📂 Project Structure

    campus-queue-management-system/
    ├── frontend/
    ├── backend/
    ├── Chatbot/
    ├── docs/
    │   └── images/
    └── README.md

## ⚙️ Installation

### Backend

    cd backend
    npm install
    npm start

### Frontend

    cd frontend
    npm install
    npm run dev

### AI Chatbot

    cd Chatbot
    pip install -r requirements.txt
    python main.py

## 🌐 Deployment

- Frontend: Netlify
- Backend: Render
- Database: MongoDB Atlas
- AI Service: Render

## 👥 Team

- Sonu Kumar
- Bhavik Sharma
- Dhruv Dalal

## 🎓 Project

**KIET Smart Queue – A Real-Time Digital Campus Queue Management System**

Developed as an MCA project at **KIET Deemed To Be University**.
