import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../lib/api.js";

const AuthContext = createContext(null);
const TOKEN_KEY = "our911.accessToken";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [guest, setGuest] = useState(
    () => window.sessionStorage.getItem("our911.guest") === "true",
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/auth/me")
      .then(({ data }) => {
        setUser(data.user);
        setGuest(false);
        window.sessionStorage.removeItem("our911.guest");
      })
      .catch(() => {
        window.localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { data } = await api.post("/auth/login", { email, password });
    window.localStorage.setItem(TOKEN_KEY, data.access_token);
    window.sessionStorage.removeItem("our911.guest");
    setGuest(false);
    setUser(data.user);
    return data.user;
  }

  async function register(fullName, email, password) {
    await api.post("/auth/register", {
      full_name: fullName,
      email,
      password,
    });
    return login(email, password);
  }

  async function updateProfile(fullName) {
    const { data } = await api.patch("/auth/me", { full_name: fullName });
    setUser(data.user);
    return data.user;
  }

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY);
    window.sessionStorage.removeItem("our911.guest");
    setUser(null);
    setGuest(false);
  }

  function continueAsGuest() {
    window.localStorage.removeItem(TOKEN_KEY);
    window.sessionStorage.setItem("our911.guest", "true");
    setUser(null);
    setGuest(true);
  }

  const value = useMemo(
    () => ({
      user,
      guest,
      loading,
      login,
      register,
      updateProfile,
      logout,
      continueAsGuest,
    }),
    [user, guest, loading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}

export function getApiError(error) {
  return (
    error.response?.data?.error ??
    error.response?.data?.message ??
    "Something went wrong. Please try again."
  );
}
