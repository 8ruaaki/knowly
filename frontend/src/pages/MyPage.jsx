import React, { useState, useEffect, useRef } from 'react';
import { Camera, Save, X, Edit2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import BottomNav from '../components/ui/BottomNav';
import Input from '../components/ui/Input';
import { api } from '../api';
import RefineInterestModal from '../components/RefineInterestModal';

const UserAvatar = ({ url, name, size = "lg" }) => {
    const [error, setError] = useState(false);

    const sizeClasses = {
        sm: "w-12 h-12 text-lg",
        lg: "w-24 h-24 text-3xl"
    };

    if (url && !error) {
        return (
            <img
                src={url}
                alt={name}
                className={`object-cover rounded-full ${size === 'lg' ? 'w-24 h-24' : 'w-12 h-12'}`}
                referrerPolicy="no-referrer"
                onError={() => setError(true)}
            />
        );
    }

    return (
        <div className={`rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden ${sizeClasses[size]}`}>
            <span className="text-indigo-600 font-bold">{name ? name[0].toUpperCase() : '?'}</span>
        </div>
    );
};

const MyPage = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    // Edit Form State
    const [editNickname, setEditNickname] = useState('');
    const [editInterests, setEditInterests] = useState([]);
    const [newInterest, setNewInterest] = useState('');
    const [avatarFile, setAvatarFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);

    // Refinement State
    const [refiningInterest, setRefiningInterest] = useState(null);

    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchUserData();
    }, []);

    const fetchUserData = async () => {
        try {
            const savedUser = localStorage.getItem('user');
            const userId = savedUser ? JSON.parse(savedUser).user_id : null;
            if (!userId) {
                setLoading(false);
                return;
            }

            const res = await api.getUser(userId);
            if (res.status === 'success') {
                setUser(res);
                setEditNickname(res.nickname);
                setEditInterests(Array.isArray(res.interests) ? res.interests : []);
            }
        } catch (error) {
            console.error("Failed to load user:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setAvatarFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const initAddInterest = () => {
        if (newInterest.trim() && !editInterests.includes(newInterest.trim())) {
            setRefiningInterest(newInterest.trim());
        }
    };

    const handleRefinementComplete = (finalTopic) => {
        if (finalTopic && !editInterests.includes(finalTopic)) {
            setEditInterests([...editInterests, finalTopic]);
        }
        setNewInterest('');
        setRefiningInterest(null);
    };

    const removeInterest = (interest) => {
        setEditInterests(editInterests.filter(i => i !== interest));
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            const profileData = {
                nickname: editNickname,
                interests: editInterests,
            };

            if (avatarFile) {
                const reader = new FileReader();
                reader.readAsDataURL(avatarFile);
                reader.onloadend = async () => {
                    const base64Content = reader.result.split(',')[1];
                    const mimeType = avatarFile.type;

                    profileData.avatar_base64 = base64Content;
                    profileData.avatar_mimeType = mimeType;

                    await submitUpdate(profileData);
                };
            } else {
                await submitUpdate(profileData);
            }

        } catch (error) {
            console.error("Update failed:", error);
            setSaving(false);
        }
    };

    const submitUpdate = async (data) => {
        const res = await api.updateProfile(user.user_id, data);
        if (res.status === 'success' || res.avatar_url) {
            // Update local state properly
            const updatedUser = {
                ...user,
                nickname: data.nickname,
                interests: data.interests,
                avatar_url: res.avatar_url || user.avatar_url // Use new URL if returned
            };
            setUser(updatedUser);
            setIsEditing(false);
            setAvatarFile(null);
            setPreviewUrl(null);

            // Update local storage for other views
            const saved = JSON.parse(localStorage.getItem('user'));
            localStorage.setItem('user', JSON.stringify({ ...saved, nickname: data.nickname }));
        }
        setSaving(false);
    };

    if (loading) return <div className="text-center py-20">Loading...</div>;
    if (!user) return <div className="text-center py-20">User not found. Please log in again.</div>;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm relative">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Link to="/" className="text-gray-500 hover:text-gray-800">
                            <ArrowLeft size={24} />
                        </Link>
                        <h1 className="text-xl font-bold text-gray-800">My Page</h1>
                    </div>
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                        >
                            <Edit2 size={20} />
                        </button>
                    )}
                </div>

                <div className="flex flex-col items-center">
                    <div className="relative">
                        <UserAvatar
                            url={previewUrl || user.avatar_url}
                            name={editNickname}
                            size="lg"
                        />
                        {isEditing && (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
                            >
                                <Camera size={16} />
                            </button>
                        )}
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                    </div>

                    {!isEditing ? (
                        <h2 className="mt-4 text-2xl font-bold text-gray-800">{user.nickname}</h2>
                    ) : (
                        <div className="mt-4 w-full max-w-xs">
                            <Input
                                value={editNickname}
                                onChange={(e) => setEditNickname(e.target.value)}
                                placeholder="Nickname"
                                className="text-center text-lg font-bold"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-6">
                <div className="bg-white rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Interests</h3>

                    {isEditing && (
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={newInterest}
                                onChange={(e) => setNewInterest(e.target.value)}
                                placeholder="Add interest (e.g. K-pop)"
                                className="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && initAddInterest()}
                            />
                            <button
                                onClick={initAddInterest}
                                className="px-4 py-2 bg-gray-100 font-medium rounded-lg hover:bg-gray-200"
                            >
                                Add
                            </button>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        {(isEditing ? editInterests : user.interests).map((interest, idx) => (
                            <span
                                key={idx}
                                className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium flex items-center gap-1"
                            >
                                # {interest}
                                {isEditing && (
                                    <button onClick={() => removeInterest(interest)} className="hover:text-red-500 ml-1">
                                        <X size={14} />
                                    </button>
                                )}
                            </span>
                        ))}
                        {(isEditing ? editInterests : user.interests).length === 0 && (
                            <span className="text-gray-400 italic">No interests added yet.</span>
                        )}
                    </div>
                </div>

                {isEditing && (
                    <div className="mt-8 flex gap-4">
                        <button
                            onClick={() => {
                                setIsEditing(false);
                                setEditNickname(user.nickname); // Reset
                                setEditInterests(user.interests);
                                setAvatarFile(null);
                                setPreviewUrl(null);
                            }}
                            className="flex-1 py-3 bg-gray-200 font-bold text-gray-700 rounded-xl hover:bg-gray-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 py-3 bg-indigo-600 font-bold text-white rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                        >
                            {saving ? 'Saving...' : <><Save size={20} /> Save Changes</>}
                        </button>
                    </div>
                )}
            </div>

            {refiningInterest && (
                <RefineInterestModal
                    initialInterest={refiningInterest}
                    onClose={() => setRefiningInterest(null)}
                    onComplete={handleRefinementComplete}
                />
            )}

            <BottomNav />
        </div>
    );
};

export default MyPage;
