import React from 'react';
import { Search, User, Award } from 'lucide-react';
import { Link } from 'react-router-dom';

const BottomNav = () => {
    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-100 px-6 py-4 flex justify-between items-center z-50 shadow-lg shadow-indigo-100/20">
            <NavButton icon={Search} label="Find Friends" to="/search" />
            <NavButton icon={User} label="My Page" to="/mypage" />
            <NavButton icon={Award} label="Badges" to="/badges" />
        </div>
    );
};

const NavButton = ({ icon: Icon, label, to }) => (
    <Link
        to={to}
        className="flex flex-col items-center gap-1 text-gray-400 hover:text-indigo-600 transition-colors duration-200"
    >
        <div className="p-2 rounded-xl hover:bg-indigo-50 transition-colors">
            <Icon size={24} strokeWidth={2} />
        </div>
        <span className="text-[10px] font-medium tracking-wide">{label}</span>
    </Link>
);

export default BottomNav;
