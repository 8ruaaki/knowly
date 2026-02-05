import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { api } from '../api';
import Bubble from '../components/ui/Bubble';
import BottomNav from '../components/ui/BottomNav';
import LevelSelectionModal from '../components/LevelSelectionModal';

const DashboardPage = () => {
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTopic, setSelectedTopic] = useState(null);
    const [topicProgress, setTopicProgress] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // For force layout
    const containerRef = useRef(null);
    const requestRef = useRef();

    useEffect(() => {
        const fetchInterests = async () => {
            try {
                const savedUser = localStorage.getItem('user');
                const userId = savedUser ? JSON.parse(savedUser).user_id : 'guest';
                const res = await api.getExploreInterests(userId);

                if (res.status === 'success' && res.interests) {
                    const bubbles = res.interests.map((interest, index) => ({
                        id: index,
                        text: interest,
                        // Initial random positions
                        x: Math.random() * 80 + 10,
                        y: Math.random() * 60 + 10,
                        vx: (Math.random() - 0.5) * 0.2, // Velocity
                        vy: (Math.random() - 0.5) * 0.2,
                        size: Math.random() > 0.6 ? 80 : (Math.random() > 0.3 ? 60 : 45), // Numeric size for collision
                        sizeProp: Math.random() > 0.6 ? 'lg' : (Math.random() > 0.3 ? 'md' : 'sm'),
                        delay: Math.random() * 2
                    }));
                    setTopics(bubbles);
                }
            } catch (error) {
                console.error("Failed to fetch interests:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchInterests();
    }, []);

    // Simple Force Simulation
    useEffect(() => {
        const animate = () => {
            if (!containerRef.current) return;

            // Get aspect ratio for accurate collision
            const aspectRatio = window.innerWidth / window.innerHeight;

            setTopics(prevTopics => {
                const newTopics = prevTopics.map(t => ({ ...t }));

                // 1. Move
                newTopics.forEach(t => {
                    t.x += t.vx;
                    t.y += t.vy;

                    // Boundaries (bounce) with padding
                    // Keep bubbles within 5% to 95%
                    if (t.x < 5) { t.x = 5; t.vx *= -1; }
                    if (t.x > 90) { t.x = 90; t.vx *= -1; }
                    if (t.y < 5) { t.y = 5; t.vy *= -1; }
                    if (t.y > 80) { t.y = 80; t.vy *= -1; } // Bottom padding for nav
                });

                // 2. Collision Detection & Resolution
                // stronger iteration for better stability
                for (let iter = 0; iter < 3; iter++) {
                    for (let i = 0; i < newTopics.length; i++) {
                        for (let j = i + 1; j < newTopics.length; j++) {
                            const a = newTopics[i];
                            const b = newTopics[j];

                            const dx = a.x - b.x;
                            const dy = (a.y - b.y) * aspectRatio; // Correct for screen shape

                            const dist = Math.sqrt(dx * dx + dy * dy);

                            // Estimate size in % (tuned multiplier)
                            // 80px on small screen (375px) is ~21%
                            // 80px on large screen (1920px) is ~4%
                            // Use a safer fixed percentage estimate based on sizeProp
                            const sizeMap = { 'lg': 25, 'md': 20, 'sm': 15 };
                            const minDistance = (sizeMap[a.sizeProp] + sizeMap[b.sizeProp]) / 2.5;

                            if (dist < minDistance) {
                                // Push apart
                                const force = (minDistance - dist) * 0.08; // Stronger force
                                const angle = Math.atan2(dy, dx);

                                const fx = Math.cos(angle) * force;
                                const fy = Math.sin(angle) * force;

                                a.vx += fx;
                                a.vy += fy / aspectRatio;
                                b.vx -= fx;
                                b.vy -= fy / aspectRatio;
                            }
                        }
                    }
                }

                // Friction
                newTopics.forEach(t => {
                    t.vx *= 0.95; // Higher friction to stop them from jittering
                    t.vy *= 0.95;
                });

                return newTopics;
            });

            requestRef.current = requestAnimationFrame(animate);
        };

        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
    }, [loading]);

    const [fetchingProgress, setFetchingProgress] = useState(false);

    const navigate = useNavigate();

    const handleStartLevel = (level) => {
        navigate(`/quiz/${encodeURIComponent(selectedTopic)}?level=${level}`);
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        navigate('/login');
    };

    const handleBubbleClick = async (topic) => {
        const cleanTopic = topic.replace('#', '');
        setSelectedTopic(cleanTopic);
        setFetchingProgress(true); // Start loading

        try {
            // Fetch progress
            const savedUser = localStorage.getItem('user');
            const userId = savedUser ? JSON.parse(savedUser).user_id : 'guest';

            const res = await api.getTopicProgress(userId, cleanTopic);
            if (res.status === 'success') {
                setTopicProgress(res.max_level || 1);
                setIsModalOpen(true);
            }
        } catch (error) {
            console.error("Failed to fetch progress", error);
        } finally {
            setFetchingProgress(false); // Stop loading
        }
    };

    return (
        <div className="relative min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 overflow-hidden" ref={containerRef}>
            {/* Header */}
            <div className="absolute top-10 left-6 right-6 z-10 flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Explore</h1>
                    <p className="text-sm text-gray-500">Tap a bubble to start</p>
                </div>
                <button onClick={handleLogout} className="p-2 bg-white/50 backdrop-blur-sm rounded-full text-gray-600 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <LogOut size={20} />
                </button>
            </div>

            {/* Loading Overlay */}
            {fetchingProgress && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/30 backdrop-blur-sm animate-fade-in">
                    <div className="flex flex-col items-center">
                        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3"></div>
                        <p className="text-indigo-800 font-medium">Checking progress...</p>
                    </div>
                </div>
            )}

            {/* Floating Bubbles Container */}
            <div className="absolute inset-0 top-0 bottom-20">
                {!loading && topics.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                        <p className="text-gray-400 text-lg mb-4">No quizzes found.</p>
                        <p className="text-gray-500">Follow users to see their interests here!</p>
                    </div>
                ) : (
                    topics.map((topic) => (
                        <Bubble
                            key={topic.id}
                            topic={topic.text}
                            size={topic.sizeProp}
                            x={topic.x}
                            y={topic.y}
                            delay={topic.delay}
                            onClick={() => !fetchingProgress && handleBubbleClick(topic.text)}
                        />
                    ))
                )}
            </div>

            {isModalOpen && (
                <LevelSelectionModal
                    topic={selectedTopic}
                    maxLevel={topicProgress}
                    onClose={() => setIsModalOpen(false)}
                    onSelectLevel={handleStartLevel}
                />
            )}

            <BottomNav />
        </div>
    );
};

export default DashboardPage;
