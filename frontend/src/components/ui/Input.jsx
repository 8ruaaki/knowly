import React from "react";

/**
 * Reusable Input component
 * @param {string} label - Label text
 * @param {string} error - Error message
 * @param {React.ReactNode} icon - Icon component
 */
const Input = ({ label, error, icon: Icon, className = "", ...props }) => {
    return (
        <div className={`w-full ${className}`}>
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">
                    {label}
                </label>
            )}
            <div className="relative group">
                {Icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors">
                        <Icon size={20} />
                    </div>
                )}
                <input
                    className={`w-full bg-gray-50 border border-gray-200 text-gray-900 text-base rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-all placeholder:text-gray-400 ${Icon ? "pl-11" : "pl-4"
                        } ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500/20 bg-red-50/10" : "hover:border-gray-300"}`}
                    {...props}
                />
            </div>
            {error && (
                <p className="mt-1.5 ml-1 text-sm text-red-600 font-medium animate-in slide-in-from-top-1 fade-in">
                    {error}
                </p>
            )}
        </div>
    );
};

export default Input;
