import { useEffect, useState } from "react";
import { api, getSession, signOut } from "./api";
import type { User } from "./api";
import "./index.css";

const MCP_URL = "https://mcpproject4-be-tn.groo.bot";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      style={{ fontSize: 11, padding: "4px 10px" }}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div style={{ position: "relative" }}>
      <pre style={{ paddingRight: 80 }}>{code}</pre>
      <div style={{ position: "absolute", top: 8, right: 8 }}>
        <CopyButton text={code} />
      </div>
    </div>
  );
}

function ConnectPage({ token }: { token: string }) {
  const bearerUrl = `${MCP_URL}/mcp`;
  const claudeDesktopConfig = JSON.stringify(
    {
      mcpServers: {
        "workout-tracker": {
          type: "sse",
          url: bearerUrl,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2
  );

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="card mb-4">
        <h2 style={{ marginBottom: 4 }}>Connect to Claude</h2>
        <p className="text-muted" style={{ marginBottom: 20 }}>
          Your session token is active. Add the Workout Tracker to any MCP client.
        </p>

        <h3>Claude Desktop</h3>
        <p className="text-muted">
          Add this to your <code>claude_desktop_config.json</code>:
        </p>
        <CodeBlock code={claudeDesktopConfig} />

        <hr className="divider" />

        <h3>Claude.ai (Integrations)</h3>
        <p className="text-muted" style={{ marginBottom: 8 }}>
          In Claude.ai → Settings → Integrations, add a new MCP server:
        </p>
        <div className="card" style={{ background: "var(--bg)" }}>
          <table>
            <tbody>
              <tr>
                <td style={{ color: "var(--muted)", width: 120 }}>URL</td>
                <td>
                  <code>{bearerUrl}</code>
                </td>
                <td style={{ width: 80, textAlign: "right" }}>
                  <CopyButton text={bearerUrl} />
                </td>
              </tr>
              <tr>
                <td style={{ color: "var(--muted)" }}>Auth header</td>
                <td>
                  <code>Bearer {token.slice(0, 12)}…</code>
                </td>
                <td style={{ textAlign: "right" }}>
                  <CopyButton text={`Bearer ${token}`} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <hr className="divider" />

        <h3>Raw token</h3>
        <p className="text-muted" style={{ marginBottom: 8 }}>
          Use this as the <code>Authorization: Bearer &lt;token&gt;</code> header:
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <code
            style={{
              flex: 1,
              display: "block",
              padding: "10px 12px",
              wordBreak: "break-all",
              fontSize: 12,
            }}
          >
            {token}
          </code>
          <CopyButton text={token} />
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Available tools (14)</h3>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {[
            "listExercises",
            "createExercise",
            "createWorkout",
            "listWorkouts",
            "getWorkout",
            "addExerciseToWorkout",
            "logSet",
            "finishWorkout",
            "createRoutine",
            "listRoutines",
            "startWorkoutFromRoutine",
            "getPersonalRecords",
            "getVolumeOverTime",
            "getWorkoutRecommendation",
          ].map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoginPage() {
  const [signingIn, setSigningIn] = useState(false);

  async function handleGitHubLogin() {
    setSigningIn(true);
    try {
      const res = await api.post("/auth/sign-in/social", {
        provider: "github",
        callbackURL: window.location.origin,
      });
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch {
      setSigningIn(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: 24,
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏋️</div>
        <h1 style={{ margin: "0 0 8px" }}>Workout Tracker</h1>
        <p className="text-muted">MCP server for Claude — track workouts through AI</p>
      </div>

      <div className="card" style={{ width: "100%", maxWidth: 380 }}>
        <h2 style={{ marginBottom: 6 }}>Sign in</h2>
        <p className="text-muted" style={{ marginBottom: 20 }}>
          Authenticate with GitHub to get your MCP token and connect Claude.
        </p>
        <button
          className="btn primary w-full"
          style={{ justifyContent: "center" }}
          onClick={handleGitHubLogin}
          disabled={signingIn}
        >
          {signingIn ? (
            <div className="spinner" style={{ width: 16, height: 16 }} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          )}
          Continue with GitHub
        </button>
      </div>

      <div className="card" style={{ width: "100%", maxWidth: 380 }}>
        <h3 style={{ marginBottom: 12 }}>What is this?</h3>
        <p className="text-muted" style={{ marginBottom: 0 }}>
          This is an <strong style={{ color: "var(--text)" }}>MCP server</strong> that gives Claude
          the ability to log workouts, track personal records, manage routines, and analyse your
          training volume — all via natural language in Claude Desktop or claude.ai.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    getSession().then((s) => {
      if (s) {
        setUser(s.user);
        setToken(s.token);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}
      >
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 24px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🏋️</span>
          <strong style={{ color: "var(--text-h)" }}>Workout Tracker MCP</strong>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user.image && (
            <img
              src={user.image}
              alt=""
              style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--border)" }}
            />
          )}
          <span style={{ fontSize: 13, color: "var(--muted)" }}>{user.name || user.email}</span>
          <button
            style={{ fontSize: 12, padding: "4px 10px" }}
            onClick={() => signOut().then(() => setUser(null))}
          >
            Sign out
          </button>
        </div>
      </header>

      <div style={{ flex: 1, padding: "32px 24px" }}>
        <ConnectPage token={token} />
      </div>
    </div>
  );
}
