import React, { useState } from "react";
import { Plus, X } from "lucide-react";

/**
 * InterestInput component
 * @param {string[]} interests - Array of current interests
 * @param {function} onChange - Callback when interests change
 */
const InterestInput = ({ interests = [], onChange, onBeforeAdd, className = "" }) => {
    const [inputValue, setInputValue] = useState("");

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addInterest();
        }
    };

    const addInterest = () => {
        const trimmed = inputValue.trim();
        if (trimmed && !interests.includes(trimmed)) {
            if (onBeforeAdd) {
                // If parent wants to intercept (e.g. for refinement)
                onBeforeAdd(trimmed);
                setInputValue("");
            } else {
                onChange([...interests, trimmed]);
                setInputValue("");
            }
        }
    };

    const removeInterest = (interestToRemove) => {
        onChange(interests.filter((i) => i !== interestToRemove));
    };

    return (
        <div className={`w-full ${className}`}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">
                Interests & Hobbies
            </label>

            <div className="flex flex-wrap gap-2 mb-3">
                {interests.map((interest) => (
                    <span
                        key={interest}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 group transition-all hover:bg-indigo-100"
                    >
                        {interest}
                        <button
                            type="button"
                            onClick={() => removeInterest(interest)}
                            className="ml-1.5 p-0.5 rounded-full hover:bg-indigo-200 text-indigo-400 hover:text-indigo-700 transition-colors"
                        >
                            <X size={14} strokeWidth={2.5} />
                        </button>
                    </span>
                ))}
            </div>

            <div className="flex gap-2">
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Add an interest (e.g., Photography)"
                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-base rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-all placeholder:text-gray-400 hover:border-gray-300"
                    />
                </div>
                <button
                    type="button"
                    onClick={addInterest}
                    disabled={!inputValue.trim()}
                    className="flex-none p-3 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 disabled:opacity-50 disabled:hover:bg-gray-100 transition-colors"
                >
                    <Plus size={24} />
                </button>
            </div>
        </div>
    );
};

export default InterestInput;
