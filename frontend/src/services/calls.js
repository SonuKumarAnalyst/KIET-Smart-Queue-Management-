import api from "./api";

export const startVideoCall = async (ticketId) => {
  const res = await api.post("/calls/start", { ticketId });
  return res.data;
};

export const acceptVideoCall = async (callId) => {
  const res = await api.post(`/calls/${callId}/accept`);
  return res.data;
};

export const rejectVideoCall = async (callId) => {
  const res = await api.post(`/calls/${callId}/reject`);
  return res.data;
};

export const endVideoCall = async (callId) => {
  const res = await api.post(`/calls/${callId}/end`);
  return res.data;
};

export const getActiveVideoCall = async (ticketId) => {
  const res = await api.get(`/calls/active/${ticketId}`);
  return res.data;
};
