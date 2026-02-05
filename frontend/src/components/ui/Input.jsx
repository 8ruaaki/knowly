import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Reusable Input component
 * @param {string} label - Label text
 * @param {string} error - Error message
 * @param {React.ReactNode} icon - Icon component
 */
const Input = ({ label, error, icon: Icon, className = "", type = "text", ...props }) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const currentType = isPassword ? (showPassword ? "text" : "password") : type;

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
                    type={currentType}
                    className={`w-full bg-gray-50 border border-gray-200 text-gray-900 text-base rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 block p-3 transition-all placeholder:text-gray-400 ${Icon ? "pl-11" : "pl-4"
                        } ${isPassword ? "pr-11" : ""} ${error ? "border-red-500 focus:border-red-500 focus:ring-red-500/20 bg-red-50/10" : "hover:border-gray-300"}`}
                    {...props}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                    >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                )}
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
