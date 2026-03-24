import { createContext, useContext, useState, useEffect } from "react";
import { currentUser } from "../services/mockData";

const AuthContext = createContext(null);

// Mock user store (simulates backend)
const MOCK_USERS_KEY = "gscip_mock_users";
const SESSION_KEY = "gscip_session";

function getMockUsers() {
  try {
    return JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || "[]");
  } catch { return []; }
}

function saveMockUsers(users) {
  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
      try {
        setUser(JSON.parse(session));
      } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    // Check mock users first
    const users = getMockUsers();
    const found = users.find((u) => u.email === email && u.password === password);
    if (found) {
      const sessionUser = { name: found.name, email: found.email, initials: found.initials, role: found.role };
      setUser(sessionUser);
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
      return;
    }
    // Fallback: allow the default mock user
    if (email === currentUser.email && password === "admin") {
      setUser(currentUser);
      localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
      return;
    }
    throw new Error("Invalid email or password.");
  };

  const signup = async (name, email, password) => {
    const users = getMockUsers();
    if (users.find((u) => u.email === email)) {
      throw new Error("An account with this email already exists.");
    }
    const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
    const newUser = { name, email, password, initials, role: "Viewer" };
    saveMockUsers([...users, newUser]);
    const sessionUser = { name, email, initials, role: "Viewer" };
    setUser(sessionUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const hasRole = (minRole) => {
    if (!user) return false;
    const hierarchy = ["Viewer", "Analyst", "Data Scientist", "Admin"];
    return hierarchy.indexOf(user.role) >= hierarchy.indexOf(minRole);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
