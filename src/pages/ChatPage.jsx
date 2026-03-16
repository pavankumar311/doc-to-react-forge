import { useState, useRef, useEffect } from "react";
import { Send, Square, MapPin, Lightbulb } from "lucide-react";
import { chatHistory, suggestedPrompts } from "../services/mockData";

export default function ChatPage() {
  const [messages, setMessages] = useState(chatHistory);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || isGenerating) return;
    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsGenerating(true);

    setTimeout(() => {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: `Based on the current data for your query about "${input}":\n\nThe analysis shows moderate activity in the selected area with a risk score trending upward over the past 7 days. I recommend monitoring blocks 047W and 063E closely.\n\nWould you like me to drill deeper into any specific metric?`,
        source: "predictions (Feb 2025)",
        model: "graph_xgb_v2.1",
        actions: ["View on Heatmap", "Download CSV"],
      }]);
      setIsGenerating(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 160px)" }}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>Chat Assistant</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 rounded" style={{ background: "var(--color-bg-card)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}>
            Scope: District 8
          </span>
          <button className="h-8 px-3 rounded text-xs font-medium" style={{ color: "var(--color-azure)", border: "1px solid var(--color-border)" }}>New Chat</button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((msg, i) => {
          if (msg.role === "system") {
            return (
              <div key={i} className="flex justify-center">
                <div className="px-4 py-2 rounded-lg text-xs italic text-center" style={{ background: "var(--color-bg-app)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}>
                  {msg.content}
                </div>
              </div>
            );
          }
          if (msg.role === "user") {
            return (
              <div key={i} className="flex justify-end">
                <div className="max-w-[70%] px-4 py-3 text-sm leading-relaxed" style={{
                  background: "rgba(21,101,192,0.2)",
                  color: "var(--color-text-primary)",
                  borderRadius: "12px 12px 2px 12px",
                }}>
                  {msg.content}
                </div>
              </div>
            );
          }
          return (
            <div key={i} className="flex justify-start">
              <div className="max-w-[70%]">
                <div className="px-4 py-3 text-sm leading-relaxed" style={{
                  background: "var(--color-bg-card)",
                  color: "var(--color-text-primary)",
                  borderRadius: "2px 12px 12px 12px",
                }}>
                  {msg.content.split("\n").map((line, j) => (
                    <p key={j} className={line === "" ? "h-2" : ""}>{line}</p>
                  ))}
                </div>
                {msg.source && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: "#01579B", color: "#BBDEFB" }}>
                      Source: {msg.source} | Model: {msg.model}
                    </span>
                  </div>
                )}
                {msg.actions && (
                  <div className="mt-2 flex items-center gap-2">
                    {msg.actions.map((a) => (
                      <button key={a} className="h-7 px-3 rounded text-[11px] font-medium" style={{ color: "var(--color-azure)", border: "1px solid var(--color-border)" }}>
                        {a} ↗
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isGenerating && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-xl" style={{ background: "var(--color-bg-card)" }}>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-gscip-azure animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-gscip-azure animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-gscip-azure animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <p className="text-[10px] mt-1" style={{ color: "var(--color-text-muted)" }}>Generating AQL...</p>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested prompts */}
      <div className="flex items-center gap-2 mb-3">
        {suggestedPrompts.map((p) => (
          <button
            key={p}
            onClick={() => setInput(p)}
            className="h-7 px-3 rounded-full text-[11px] font-medium transition-colors"
            style={{ background: "var(--color-bg-card)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Ask about crime trends, risk scores..."
          className="flex-1 h-10 px-4 rounded-lg text-sm"
          style={{ background: "var(--color-bg-sidebar)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}
          aria-label="Ask about crime data"
        />
        {isGenerating ? (
          <button onClick={() => setIsGenerating(false)} className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: "var(--color-risk-high)" }}>
            <Square size={16} fill="#fff" color="#fff" />
          </button>
        ) : (
          <button onClick={sendMessage} className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: "var(--color-cobalt)" }}>
            <Send size={16} color="#fff" />
          </button>
        )}
      </div>
    </div>
  );
}
