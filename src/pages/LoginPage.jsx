import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Eye, EyeOff, LogIn } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.message || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-bg-app)" }}>
      <div className="w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center font-bold text-2xl" style={{ background: "var(--color-cobalt)", color: "#fff" }}>G</div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>Welcome back</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>Sign in to GSCIP Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl p-8 space-y-5" style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}>
          {error && (
            <div className="text-sm px-4 py-3 rounded-lg" style={{ background: "rgba(198,40,40,0.15)", color: "var(--color-risk-high)", border: "1px solid rgba(198,40,40,0.3)" }}>
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full h-11 px-4 rounded-lg text-sm outline-none transition-colors"
              style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>Password</label>
              <button type="button" className="text-xs hover:underline" style={{ color: "var(--color-azure)" }}>Forgot password?</button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-4 pr-11 rounded-lg text-sm outline-none transition-colors"
                style={{ background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-primary)" }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--color-text-muted)" }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "var(--color-cobalt)", color: "#fff" }}
          >
            {loading ? "Signing in..." : <><LogIn size={16} /> Sign In</>}
          </button>

          <p className="text-center text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Don't have an account?{" "}
            <Link to="/signup" className="font-medium hover:underline" style={{ color: "var(--color-azure)" }}>Sign up</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
