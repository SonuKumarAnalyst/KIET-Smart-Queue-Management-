import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { HashRouter } from "react-router-dom";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);

<nav className="fixed top-0 left-0 w-full z-50 bg-black text-white p-4">
  <div className="flex justify-between items-center">
    <h1 className="text-xl font-bold">My Website</h1>

    <ul className="flex gap-6">
      <li>Home</li>
      <li>About</li>
      <li>Contact</li>
    </ul>
  </div>
</nav>

/* ================================
   SERVICE WORKER REGISTRATION
================================ */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        console.log("✅ Service Worker registered");
      })
      .catch((error) => {
        console.error("❌ Service Worker registration failed:", error);
      });
  });
}
