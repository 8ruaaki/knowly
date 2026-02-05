import React from 'react';
import { Lock, Star, Play } from 'lucide-react';

const LevelSelectionModal = ({ topic, maxLevel, onClose, onSelectLevel }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-pop-in">

                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/70 hover:text-white"
                    >
                        Close
                    </button>
                    <h2 className="text-2xl font-bold mb-1">#{topic}</h2>
                    <p className="text-indigo-100 text-sm">Select difficulty level</p>
                </div>

                {/* Levels Grid */}
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    <div className="space-y-3">
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((level) => {
                            const isLocked = level > maxLevel;
                            const isCompleted = level < maxLevel;

                            return (
                                <button
                                    key={level}
                                    disabled={isLocked}
                                    onClick={() => onSelectLevel(level)}
                                    className={`w-full flex items-center p-4 rounded-xl border-2 transition-all duration-200
                                        ${isLocked
                                            ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                                            : 'border-indigo-100 bg-white hover:border-indigo-500 hover:bg-indigo-50 text-gray-800 shadow-sm'
                                        }
                                    `}
                                >
                                    <div className={`
                                        w-12 h-12 rounded-full flex items-center justify-center mr-4 font-bold text-lg
                                        ${isLocked ? 'bg-gray-200 text-gray-500' : 'bg-indigo-100 text-indigo-600'}
                                    `}>
                                        {level}
                                    </div>

                                    <div className="flex-1 text-left">
                                        <h3 className="font-bold text-sm">Level {level}</h3>
                                        <p className="text-xs opacity-70">
                                            {isLocked ? "Complete previous level" :
                                                isCompleted ? "Completed" : "Ready to play"}
                                        </p>
                                    </div>

                                    <div className="text-gray-400">
                                        {isLocked ? <Lock size={20} /> :
                                            isCompleted ? <Star size={20} className="text-yellow-400 fill-yellow-400" /> :
                                                <Play size={20} className="text-indigo-600 fill-indigo-600" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LevelSelectionModal;
