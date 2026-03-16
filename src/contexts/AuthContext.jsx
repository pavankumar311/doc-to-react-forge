import { createContext, useContext, useState } from "react";
import { currentUser } from "../services/mockData";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user] = useState(currentUser);

  const hasRole = (minRole) => {
    const hierarchy = ["Viewer", "Analyst", "Data Scientist", "Admin"];
    return hierarchy.indexOf(user.role) >= hierarchy.indexOf(minRole);
  };

  return (
    <AuthContext.Provider value={{ user, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
