import { useState, useRef, useEffect } from "react";
import { Send, Square, Bot, User } from "lucide-react";
import { sendChatMessage, fetchSuggestedPrompts } from "../services/api";

export default function ChatPage() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hello! I am your Crime Intelligence Assistant. How can I help you today?" }
  ]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompts, setPrompts] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setPrompts([
      "List top 10 districts along with their names which has lowest crimes in 2024?",
      "Compare District 7 and district 8 in 2024?",
      "How many active blocks are present currently in the city?"
    ]);
  }, []);

  const handleSend = async (customInput = null) => {
    // If customInput is a React event or not a string, ignore it and use state 'input'
    const textToSend = typeof customInput === "string" ? customInput : input;
    
    if (!textToSend || !textToSend.trim() || isGenerating) return;
    
    const userMsg = { role: "user", content: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsGenerating(true);

    try {
      const response = await sendChatMessage(textToSend);
      setMessages((prev) => [...prev, response]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [...prev, { 
        role: "assistant", 
        content: "I apologize, but I encountered an error while processing your request. Please try again or check your connection." 
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col max-w-5xl mx-auto w-full h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-primary)" }}>Chat Assistant</h1>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Natural language interface for Chicago Crime Intelligence</p>
        </div>
        <button 
          onClick={() => setMessages([{ role: "assistant", content: "Hello! I am your Crime Intelligence Assistant. How can I help you today?" }])}
          className="h-9 px-4 rounded-lg text-sm font-medium transition-all hover:bg-[var(--color-bg-sidebar)] active:scale-95 shadow-sm" 
          style={{ background: "var(--color-bg-card)", color: "var(--color-azure)", border: "1px solid var(--color-border)" }}
        >
          New Chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-4 mb-4" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--color-border) transparent" }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              {/* Avatar */}
              <div className="flex-shrink-0 mt-1">
                <div className="w-9 h-9 rounded-full flex items-center justify-center border shadow-sm transition-transform hover:scale-105" 
                     style={{ 
                       background: msg.role === "user" ? "var(--color-cobalt)" : "var(--color-bg-card)",
                       borderColor: "var(--color-border)"
                     }}>
                  {msg.role === "user" ? <User size={18} color="#fff" /> : <Bot size={18} color="var(--color-azure)" />}
                </div>
              </div>

              {/* Bubble */}
              <div className="flex flex-col gap-1.5">
                <div className={`px-4 py-3 text-[14px] leading-relaxed shadow-sm ring-1 ring-black/5 ${
                  msg.role === "user" 
                  ? "rounded-2xl rounded-tr-none text-white font-medium" 
                  : "rounded-2xl rounded-tl-none border"
                }`} 
                style={{
                  background: msg.role === "user" ? "var(--color-cobalt)" : "var(--color-bg-card)",
                  borderColor: msg.role === "user" ? "transparent" : "var(--color-border)",
                  color: msg.role === "user" ? "#fff" : "var(--color-text-primary)"
                }}>
                  {msg.content.split("\n").map((line, j) => (
                    <p key={j} className={line === "" ? "h-2" : "mb-1 last:mb-0"}>{line}</p>
                  ))}
                </div>
                <span className="text-[10px] opacity-60 font-medium px-1 tracking-wide uppercase" style={{ textAlign: msg.role === "user" ? "right" : "left", color: "var(--color-text-secondary)" }}>
                  {msg.role === "user" ? "Authorized User" : "GSCIP Assistant"}
                </span>
              </div>
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex justify-start animate-in fade-in duration-300">
            <div className="flex gap-3 max-w-[85%]">
              <div className="flex-shrink-0 mt-1">
                <div className="w-9 h-9 rounded-full flex items-center justify-center border border-[var(--color-border)] shadow-sm bg-[var(--color-bg-card)]">
                  <Bot size={18} color="var(--color-azure)" />
                </div>
              </div>
              <div className="px-5 py-3.5 rounded-2xl rounded-tl-none border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-sm flex items-center gap-3">
                <div className="flex gap-1.5 items-center">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: "200ms" }} />
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: "400ms" }} />
                </div>
                <span className="text-xs font-medium text-[var(--color-text-muted)] tracking-tight">Analyzing Crime Records...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Suggested Prompts */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[10px] text-[var(--color-text-muted)] w-full mb-1 ml-1 font-semibold uppercase tracking-wider">Suggested Queries</span>
        {prompts.map((p) => (
          <button
            key={p}
            onClick={() => handleSend(p)}
            className="px-4 py-2 rounded-full text-[11px] font-semibold transition-all hover:bg-[var(--color-azure)] hover:text-white hover:border-transparent active:scale-95 shadow-sm bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-secondary)]"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Area */}
      <div className="relative group">
        <div className="flex items-center gap-3 p-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-lg focus-within:ring-4 focus-within:ring-blue-500/10 transition-all duration-300">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Search crime database using natural language..."
            className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm px-4 py-2"
            style={{ color: "var(--color-text-primary)" }}
            aria-label="Natural language query"
          />
          {isGenerating ? (
            <button 
              onClick={() => setIsGenerating(false)} 
              className="h-9 w-9 rounded-lg flex items-center justify-center transition-all hover:opacity-90 active:scale-90" 
              style={{ background: "var(--color-risk-high)" }}
            >
              <Square size={16} fill="#fff" color="#fff" />
            </button>
          ) : (
            <button 
              onClick={handleSend} 
              disabled={!input.trim()}
              className="h-9 w-9 rounded-lg flex items-center justify-center transition-all hover:opacity-90 active:scale-90 disabled:opacity-30 disabled:grayscale" 
              style={{ background: "var(--color-cobalt)" }}
            >
              <Send size={16} color="#fff" />
            </button>
          )}
        </div>
        <p className="text-[10px] text-center mt-2" style={{ color: "var(--color-text-muted)" }}>
          Powered by GSCIP AI • Querying ArangoDB Silver & Gold Layers
        </p>
      </div>
    </div>
  );
}

