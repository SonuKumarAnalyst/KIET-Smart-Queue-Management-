import { io } from "socket.io-client";

const isLocalBrowser = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const socketBaseUrl = isLocalBrowser
  ? import.meta.env.VITE_API_URL.replace("/api", "")
  : `${window.location.protocol}//${window.location.hostname}:5000`;

export const socket = io(socketBaseUrl, {
  withCredentials: true,
  transports: ["websocket"],
});
