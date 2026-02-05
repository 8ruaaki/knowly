import React from "react";
import { Loader2 } from "lucide-react";

/**
 * Reusable Button component
 * @param {string} variant - primary, secondary, outline, ghost
 * @param {string} size - sm, md, lg
 * @param {boolean} isLoading - Shows loading spinner
 * @param {React.ReactNode} children
 */
const Button = ({
  variant = "primary",
  size = "md",
  isLoading = false,
  className = "",
  children,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";

  const variants = {
    primary:
      "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:from-violet-500 hover:to-indigo-500 ring-indigo-500",
    secondary:
      "bg-white text-gray-900 border border-gray-200 shadow-sm hover:bg-gray-50 ring-gray-200",
    outline:
      "border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 ring-indigo-500",
    ghost: "text-gray-600 hover:bg-gray-100 hover:text-gray-900 ring-gray-200",
  };

  const sizes = {
    sm: "h-9 px-4 text-sm",
    md: "h-11 px-6 text-base",
    lg: "h-14 px-8 text-lg",
  };

  const variantStyles = variants[variant] || variants.primary;
  const sizeStyles = sizes[size] || sizes.md;

  return (
    <button
      className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
      {children}
    </button>
  );
};

export default Button;
