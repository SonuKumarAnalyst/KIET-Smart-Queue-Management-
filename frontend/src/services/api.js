import axios from "axios";

const isLocalBrowser = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const apiBaseUrl = isLocalBrowser
  ? import.meta.env.VITE_API_URL
  : `${window.location.protocol}//${window.location.hostname}:5000/api`;

const api = axios.create({
baseURL: apiBaseUrl,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
