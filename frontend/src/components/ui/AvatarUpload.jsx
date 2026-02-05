import React, { useRef, useState } from "react";
import { Camera, Upload } from "lucide-react";

/**
 * AvatarUpload component
 * @param {string} preview - Current preview URL
 * @param {function} onChange - Callback with file object
 */
const AvatarUpload = ({ preview, onChange, className = "" }) => {
    const fileInputRef = useRef(null);
    const [internalPreview, setInternalPreview] = useState(null);

    const displayPreview = preview || internalPreview;

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            // Create local preview
            const objectUrl = URL.createObjectURL(file);
            setInternalPreview(objectUrl);
            onChange(file);

            // Cleanup previous object url if needed (simplified here)
        }
    };

    return (
        <div className={`flex flex-col items-center justify-center ${className}`}>
            <div
                className="relative group cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
            >
                <div
                    className={`w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-xl transition-all group-hover:shadow-2xl group-hover:scale-105 ${!displayPreview ? 'bg-indigo-50 flex items-center justify-center' : ''
                        }`}
                >
                    {displayPreview ? (
                        <img
                            src={displayPreview}
                            alt="Avatar preview"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <Camera size={40} className="text-indigo-300" />
                    )}

                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                        <Upload className="text-white" size={24} />
                    </div>
                </div>

                <div className="absolute bottom-0 right-0 bg-white p-2 rounded-full shadow-lg border border-gray-100 text-indigo-600 group-hover:text-indigo-700 transition-colors">
                    <Camera size={18} />
                </div>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
            />

            <p className="mt-4 text-sm text-gray-500 font-medium">Add a profile photo</p>
        </div>
    );
};

export default AvatarUpload;
