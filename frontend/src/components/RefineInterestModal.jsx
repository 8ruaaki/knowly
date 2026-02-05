import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, X, Check } from 'lucide-react';
import { api } from '../api';

const RefineInterestModal = ({ initialInterest, onClose, onComplete }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentCandidate, setCurrentCandidate] = useState(initialInterest);

    // Auto-scroll
    const messagesEndRef = useRef(null);
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };
    useEffect(scrollToBottom, [messages]);

    const hasStartedRef = useRef(false);

    useEffect(() => {
        // Initial check - prevent double firing in StrictMode
        if (!hasStartedRef.current) {
            hasStartedRef.current = true;
            checkInterest(initialInterest);
        }
    }, []);

    const checkInterest = async (interest) => {
        setLoading(true);
        // Add user message if it's not the initial one
        if (interest !== initialInterest) {
            setMessages(prev => [...prev, { role: 'user', text: interest }]);
        }

        try {
            // Pass recent history to backend
            const history = messages.map(m => ({ role: m.role, text: m.text }));
            const res = await api.refineInterest(interest, history);

            if (res.status === 'broad') {
                setMessages(prev => [...prev, { role: 'ai', text: res.question }]);
                setCurrentCandidate(interest);
            } else if (res.status === 'specific') {
                onComplete(res.refined_topic || interest);
            } else {
                // Handle 'error' or unknown status (e.g. backend not deployed)
                console.warn("Unexpected status:", res);
                setMessages(prev => [...prev, {
                    role: 'ai',
                    text: 'Unable to refine interest. Please try again or check backend deployment.'
                }]);
            }
        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, {
                role: 'ai',
                text: 'Connection error. Please check your network or backend URL.'
            }]);
            // Do NOT close automatically on error, let user see it.
        } finally {
            setLoading(false);
        }
    };

    const handleSend = () => {
        if (!input.trim()) return;
        const nextInterest = input.trim();
        setInput('');
        checkInterest(nextInterest);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full h-[90vh] sm:h-[500px] sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col animate-pop-in">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Sparkles size={20} className="text-yellow-300" />
                        <h2 className="font-bold">Interests AI</h2>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
                    {messages.length === 0 && loading && (
                        <div className="text-center text-gray-400 mt-10">
                            Thinking...
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`
                                max-w-[80%] p-3 rounded-2xl text-sm
                                ${msg.role === 'user'
                                    ? 'bg-indigo-600 text-white rounded-br-none'
                                    : 'bg-white text-gray-800 shadow-sm rounded-bl-none border border-gray-100'}
                            `}>
                                {msg.text}
                            </div>
                        </div>
                    ))}

                    {loading && messages.length > 0 && (
                        <div className="flex justify-start">
                            <div className="bg-white p-3 rounded-2xl rounded-bl-none shadow-sm border border-gray-100 flex gap-1">
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-gray-100">
                    <div className="flex gap-2">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Type your answer..."
                            className="flex-1 bg-gray-100 border-none rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                            disabled={loading}
                        />
                        <button
                            onClick={handleSend}
                            disabled={loading || !input.trim()}
                            className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                    <p className="text-xs text-center text-gray-400 mt-2">
                        AI helps make your interest specific for better quizzes.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RefineInterestModal;
