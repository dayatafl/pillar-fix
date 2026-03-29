import axios from "axios";

const api = axios.create({
  baseURL: "https://backend-3jwto.ondigitalocean.app/",
  headers: { "Content-Type": "application/json" },
});

export default api;