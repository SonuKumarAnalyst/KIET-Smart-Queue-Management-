import api from "./api";

export const createSupportRequest = async (payload) => {
  const res = await api.post("/support/requests", payload);
  return res.data;
};

export const getMySupportRequests = async () => {
  const res = await api.get("/support/requests/mine");
  return res.data;
};

export const getDepartmentSupportRequests = async () => {
  const res = await api.get("/staff/support-requests");
  return res.data;
};

export const updateSupportRequest = async (id, payload) => {
  const res = await api.put(`/staff/support-requests/${id}`, payload);
  return res.data;
};
