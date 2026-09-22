# 🎓 KIET Smart Queue Management System

A real-time, role-based KIET Smart Queue management system built to streamline department queues for students, staff, admins, and guests using modern web technologies. 

**🚀 NEW: Nebula UI Upgrade** – Featuring a futuristic dark theme with mesh gradients, glassmorphism, and smooth floating animations.

---

## 📌 Problem Statement
In many campuses:
- Students crowd department offices causing physical congestion.
- Queue status is unclear, leading to "wait-time anxiety."
- Staff manually manage turn order, which is prone to errors.
- Guests have no structured way to join or track queues.

**This project solves these problems by providing:**
- **Live queue visibility** across all departments.
- **Controlled access** via secure authentication or guest QR tokens.
- **Role-based actions** tailored for Students, Staff, and Admins.
- **Real-time updates** powered by WebSockets (Socket.IO).

---

## 👥 User Roles & Capabilities

### 👨‍🎓 Student (Enhanced Experience)
- **Join Queue**: Join a department queue and track live position with a dynamic progress bar.
- **Real-time Tracking**: See "Now Serving" tickets, your exact position, and live ETAs.
- **Wait-Time Heatmaps**: Visual traffic forecasting showing peak hours to help you choose the best time to visit.
- **Step Away (Hold)**: Temporarily pause your position (e.g., for a coffee break) and resume with "I'M BACK."
- **Emergency Priority**: Request urgent assistance with proof upload (moves to top upon staff approval).
- **Gamification**: Play the **Queue Runner** mini-game while waiting to earn badges like "Patient Pro."
- **Feedback & History**: View past tickets and rate services using sentiment-aware feedback forms.

### 👩‍💼 Staff (Live Ops Center)
- **Command Center**: Intuitive "Now Serving" dashboard with real-time department stats.
- **Queue Management**: Call next ticket, complete service, or mark no-shows with a single click.
- **Emergency Handling**: Real-time alerts for pending emergency requests with proof verification.
- **Smart Transfers**: Forward tickets to other departments with internal notes and priority placement.
- **Broadcast**: Send instant announcements to all students currently in your department's queue.
- **QR Generator**: Generate dynamic QR codes for physical counters to allow guest check-ins.

### 🛠️ Admin (Strategic Oversight)
- **Staff Load Balancing**: **[NEW]** AI-driven dashboard that suggests moving staff from quiet departments to congested ones based on real-time "Load Scores."
- **System Heatmap**: Monitor wait times and congestion levels across the entire campus.
- **Department & Staff Mgmt**: Create/edit departments and assign staff members dynamically.
- **Audit Logs**: Full transparency with logs of every administrative action and system change.
- **Advanced Analytics**: Granular data on service efficiency, student satisfaction, and traffic trends.

### 🧍 Guest (QR-based)
- **Instant Access**: Join a queue via QR scan without account creation.
- **Token Persistence**: Your ticket and position stay active even if you close the browser.

---

## 🤖 Enhanced AI Chatbot
The system includes a **FastAPI-powered AI Assistant** that:
- **Real-time Status**: Can check your active ticket number, position, and status (including Hold/No-Show).
- **Contextual RAG**: Answers system-related questions using an expanded Knowledge Base.
- **Sentiment Analysis**: Automatically analyzes student feedback to gauge satisfaction.
- **Auto-Discovery**: Robust database connection that automatically detects and syncs with the campus data.

---

## ⚡ Technical Features
- **Nebula Design System**: Built with advanced CSS mesh gradients and Framer Motion for a premium look.
- **Real-Time Synchronization**: Socket.IO integration for zero-refresh updates.
- **Web-Push Notifications**: Browser alerts when it's your turn, even if the tab is in the background.
- **Mobile First**: Fully responsive layout optimized for student smartphones.
- **Secure Architecture**: JWT-based authentication with strict role-level middleware protection.

---

## 🛠️ Tech Stack
| Component | Technologies |
| :--- | :--- |
| **Frontend** | React.js (v19), Tailwind CSS, Framer Motion, Recharts, Lucide Icons, Lenis |
| **Backend** | Node.js, Express.js, MongoDB, Mongoose, Socket.IO, Multer, Web-Push |
| **AI/Service** | Python, FastAPI, Ollama (TinyLlama), Uvicorn |

---

## ⚙️ Installation & Setup

### 1️⃣ Clone & Install
```bash
git clone https://github.com/your-username/campus-queue-management-system.git
cd campus-queue-management-system
```

### 2️⃣ Backend Configuration
```bash
cd backend && npm install
```
**Create `.env`:**
```env
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret_key
VAPID_PUBLIC_KEY=your_key
VAPID_PRIVATE_KEY=your_key
```

### 3️⃣ Frontend Configuration
```bash
cd ../frontend && npm install
npm run dev
```

### 4️⃣ Chatbot Service (Optional)
```bash
cd ../Chatbot
pip install -r requirements.txt
python main.py
```

## 🌐 Deployment for College Demo

For a QR code that works from any network, deploy the three parts separately:

1. **MongoDB Atlas**: keep the database online.
2. **Chatbot**: deploy the `Chatbot` folder as a Python web service on Render.
	- Build command: `pip install -r requirements.txt`
	- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
	- Environment variables: `MONGO_URI` and `PORT` (Render supplies `PORT`).
3. **Backend**: deploy the `backend` folder as a Node web service.
	- Build command: `npm install`
	- Start command: `npm start`
	- Environment variables:
	  ```env
	  PORT=10000
	  MONGO_URI=your_mongodb_atlas_uri
	  JWT_SECRET=your_long_secret
	  FRONTEND_BASE_URL=https://your-frontend-domain
	  CHATBOT_URL=https://your-chatbot-service.onrender.com
	  VAPID_PUBLIC_KEY=your_public_key
	  VAPID_PRIVATE_KEY=your_private_key
	  CHATBOT_AUTOSTART=false
	  ```
4. **Frontend**: deploy the `frontend` folder to Netlify or Vercel.
	- Build command: `npm run build`
	- Publish directory: `dist`
	- Environment variable:
	  ```env
	  VITE_API_URL=https://your-backend-service.onrender.com/api
	  VITE_VAPID_PUBLIC_KEY=your_public_key
	  ```

After deployment, generate a fresh staff QR code. It will contain the public frontend URL and can be scanned using mobile data or any Wi-Fi network.

Never commit `.env` files or expose MongoDB passwords and VAPID private keys. After the first deploy, test signup, login, student queue joining, staff QR scanning, and chatbot requests from a phone.

---

