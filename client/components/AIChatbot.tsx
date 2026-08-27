"use client";
import { useState, useRef, useEffect } from 'react';
import api from '@/lib/api';

interface Message { id: string; role: 'user' | 'assistant'; content: string; }

export default function AIChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ id: '1', role: 'assistant', content: "Hi! 👋 I'm TaskFlow AI powered by Groq. Ask me anything about your projects, tasks, roles, or how to use the app." }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const chatHistory = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const res = await api.post('/chat', { messages: chatHistory });
      const reply = res.data.data.reply;
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: "Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(!open)} aria-label="AI Assistant"
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-2xl shadow-lg flex items-center justify-center transition-all z-50 hover:scale-105 hover:bg-primary/90">
        {open ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 w-[400px] h-[520px] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
              <div><p className="text-foreground text-sm font-semibold">TaskFlow AI</p><p className="text-green-500 text-xs">Powered by Groq</p></div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-accent text-foreground rounded-bl-sm border border-border'}`}>{msg.content}</div>
              </div>
            ))}
            {loading && <div className="flex justify-start"><div className="bg-accent border border-border p-3 rounded-2xl rounded-bl-sm"><div className="flex gap-1"><span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" /><span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" /><span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" /></div></div></div>}
            <div ref={end} />
          </div>
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }} placeholder="Ask anything..."
                className="flex-1 px-4 py-2.5 bg-accent border border-border rounded-xl text-foreground text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" disabled={loading} />
              <button onClick={send} disabled={!input.trim() || loading} className="px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-30 text-primary-foreground rounded-xl transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
