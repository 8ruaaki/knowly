import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Award, Loader } from 'lucide-react';
import BottomNav from '../components/ui/BottomNav';

const BadgesPage = () => {
    const [loading, setLoading] = useState(true);
    const [badges, setBadges] = useState([]);

    useEffect(() => {
        const fetchBadges = async () => {
            try {
                const savedUser = localStorage.getItem('user');
                const userId = savedUser ? JSON.parse(savedUser).user_id : null;
                if (!userId) return;

                const res = await api.getUserBadges(userId);
                if (res.status === 'success') {
                    setBadges(res.badges);
                }
            } catch (err) {
                console.error("Failed to fetch badges", err);
            } finally {
                setLoading(false);
            }
        };

        fetchBadges();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white p-6 shadow-sm mb-6 sticky top-0 z-10">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Award className="text-yellow-500" />
                    My Badges
                </h1>
                <p className="text-sm text-gray-500">Collect badges by mastering Level 10</p>
            </div>

            {/* List */}
            <div className="px-6 grid grid-cols-2 gap-4">
                {loading ? (
                    <div className="col-span-2 flex justify-center py-10">
                        <Loader className="animate-spin text-indigo-400" />
                    </div>
                ) : badges.length === 0 ? (
                    <div className="col-span-2 text-center py-10 text-gray-400">
                        <p>No badges yet.</p>
                        <p className="text-sm mt-2">Clear Level 10 to earn one!</p>
                    </div>
                ) : (
                    badges.map((badge, index) => (
                        <div key={index} className="bg-gradient-to-br from-yellow-50 to-white p-4 rounded-xl shadow-md border border-yellow-100 flex flex-col items-center justify-center text-center animate-pop-in">
                            <div className="w-16 h-16 bg-gradient-to-tr from-yellow-400 to-yellow-200 rounded-full flex items-center justify-center shadow-lg mb-3 ring-4 ring-yellow-100">
                                <Award className="text-white drop-shadow-md" size={32} />
                            </div>
                            <span className="font-bold text-gray-800 line-clamp-2">{badge.topic}</span>
                            <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-semibold">Master</span>
                        </div>
                    ))
                )}
            </div>

            <BottomNav />
        </div>
    );
};

export default BadgesPage;
