import React, { useState } from 'react';
import { Search, UserPlus, UserCheck, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import Input from '../components/ui/Input';
import BottomNav from '../components/ui/BottomNav';
import { api } from '../api';

const UserAvatar = ({ url, name }) => {
    const [error, setError] = useState(false);

    if (url && !error) {
        return (
            <img
                src={url}
                alt={name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={() => setError(true)}
            />
        );
    }

    return (
        <span className="text-indigo-600 font-bold text-lg">{name ? name[0].toUpperCase() : '?'}</span>
    );
};

const UserCard = ({ user, onToggle }) => (
    <div className="bg-white p-4 rounded-xl flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden">
                <UserAvatar url={user.avatar_url} name={user.nickname} />
            </div>
            <span className="font-medium text-gray-800">{user.nickname}</span>
        </div>

        <button
            onClick={onToggle}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${user.is_following
                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
        >
            {user.is_following ? (
                <>
                    <UserCheck size={16} />
                    Following
                </>
            ) : (
                <>
                    <UserPlus size={16} />
                    Follow
                </>
            )}
        </button>
    </div>
);

const FindFriendsPage = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState([]); // Search results
    const [followingUsers, setFollowingUsers] = useState([]); // Following list
    const [activeTab, setActiveTab] = useState('search'); // 'search' or 'following'
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setSearching(true);
        try {
            const savedUser = localStorage.getItem('user');
            const userId = savedUser ? JSON.parse(savedUser).user_id : 'guest';

            const res = await api.searchUsers(searchQuery, userId);
            if (res.status === 'success') {
                setUsers(res.users);
            }
        } catch (error) {
            console.error("Search failed:", error);
        } finally {
            setSearching(false);
        }
    };

    // Load following list when tab changes
    const fetchFollowing = async () => {
        setLoading(true);
        try {
            const savedUser = localStorage.getItem('user');
            const userId = savedUser ? JSON.parse(savedUser).user_id : 'guest';

            const res = await api.getFollowing(userId);
            if (res.status === 'success') {
                setFollowingUsers(res.users);
            }
        } catch (error) {
            console.error("Fetch following failed:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab === 'following') {
            fetchFollowing();
        }
    };

    const handleToggleFollow = async (targetUserId) => {
        try {
            const savedUser = localStorage.getItem('user');
            const currentUserId = savedUser ? JSON.parse(savedUser).user_id : null;
            if (!currentUserId) return;

            // Optimistic update for both lists
            setUsers(users.map(u =>
                u.user_id === targetUserId
                    ? { ...u, is_following: !u.is_following }
                    : u
            ));

            // If we are in 'following' tab and unfollow, ideally we remove it,
            // but for smooth UI maybe just show as not following?
            // Actually removing it is clearer for "Following List"
            if (activeTab === 'following') {
                setFollowingUsers(followingUsers.filter(u => u.user_id !== targetUserId));
            } else {
                // Update following users state if it exists in background (optional)
            }

            await api.toggleFollow(currentUserId, targetUserId);
            // In a real app, might want to revert if API fails
        } catch (error) {
            console.error("Follow toggle failed:", error);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm sticky top-0 z-10">
                <div className="flex items-center gap-3 mb-4">
                    <Link to="/" className="text-gray-500 hover:text-gray-800">
                        <ArrowLeft size={24} />
                    </Link>
                    <h1 className="text-xl font-bold text-gray-800">Find Friends</h1>
                </div>

                <form onSubmit={handleSearch}>
                    <Input
                        icon={Search}
                        placeholder="Search by nickname..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </form>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-white">
                <button
                    onClick={() => handleTabChange('search')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'search'
                        ? 'text-indigo-600 border-b-2 border-indigo-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Search Users
                </button>
                <button
                    onClick={() => handleTabChange('following')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'following'
                        ? 'text-indigo-600 border-b-2 border-indigo-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Following
                </button>
            </div>

            {/* Results Content */}
            <div className="p-4 space-y-3">
                {activeTab === 'search' ? (
                    // Search Tab Content
                    <>
                        {searching ? (
                            <div className="text-center py-10 text-gray-400">Searching...</div>
                        ) : users.length > 0 ? (
                            users.map(user => (
                                <UserCard key={user.user_id} user={user} onToggle={() => handleToggleFollow(user.user_id)} />
                            ))
                        ) : (
                            searchQuery && !searching && (
                                <div className="text-center py-10 text-gray-400">
                                    No users found. Try a different nickname!
                                </div>
                            )
                        )}
                        {!searchQuery && users.length === 0 && (
                            <div className="text-center py-10 text-gray-400">
                                Search for friends by nickname to follow them!
                            </div>
                        )}
                    </>
                ) : (
                    // Following Tab Content
                    <>
                        {loading ? (
                            <div className="text-center py-10 text-gray-400">Loading...</div>
                        ) : followingUsers.length > 0 ? (
                            followingUsers.map(user => (
                                <UserCard key={user.user_id} user={user} onToggle={() => handleToggleFollow(user.user_id)} />
                            ))
                        ) : (
                            <div className="text-center py-10 text-gray-400">
                                You are not following anyone yet.
                            </div>
                        )}
                    </>
                )}
            </div>

            <BottomNav />
        </div>
    );
};

export default FindFriendsPage;
