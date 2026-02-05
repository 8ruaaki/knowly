import React from 'react';

const Bubble = ({ topic, size = 'md', delay = 0, x, y, onClick }) => {
    // Size mapping - Increased sizes
    const sizeClasses = {
        sm: 'w-20 h-20 md:w-28 md:h-28 text-xs md:text-sm',
        md: 'w-24 h-24 md:w-36 md:h-36 text-sm md:text-base',
        lg: 'w-28 h-28 md:w-44 md:h-44 text-base md:text-lg',
    };

    const animationStyle = {
        animation: `float 6s ease-in-out infinite`,
        animationDelay: `${delay}s`,
        left: `${x}%`,
        top: `${y}%`,
    };

    return (
        <div
            onClick={onClick}
            className={`absolute flex items-center justify-center rounded-full 
                 bg-white/40 backdrop-blur-sm border border-white/50 shadow-lg shadow-indigo-200/30
                 text-indigo-900 font-bold tracking-wide cursor-pointer
                 hover:scale-110 hover:bg-white/60 hover:shadow-indigo-300/40 transition-all duration-300
                 ${sizeClasses[size] || sizeClasses.md}`}
            style={animationStyle}
        >
            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                #{topic}
            </span>

            {/* Glossy reflection effect */}
            <div className="absolute top-4 left-6 w-1/3 h-1/4 bg-gradient-to-br from-white/80 to-transparent rounded-full opacity-60 pointer-events-none" />
        </div>
    );
};

export default Bubble;
