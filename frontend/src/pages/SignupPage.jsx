import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Lock, Mail } from "lucide-react";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import InterestInput from "../components/ui/InterestInput";
import AvatarUpload from "../components/ui/AvatarUpload";
import { api } from "../api";

import RefineInterestModal from "../components/RefineInterestModal";

const SignupPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        nickname: "",
        password: "",
        interests: [],
        avatar: null,
    });

    // Refinement State
    const [refiningInterest, setRefiningInterest] = useState(null);

    const handleRefinementComplete = (finalTopic) => {
        if (finalTopic && !formData.interests.includes(finalTopic)) {
            setFormData(prev => ({
                ...prev,
                interests: [...prev.interests, finalTopic]
            }));
        }
        setRefiningInterest(null);
    };

    const handleBeforeAddInterest = (interest) => {
        setRefiningInterest(interest);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.interests.length === 0) {
            alert("Please add at least one interest to continue.");
            return;
        }

        setLoading(true);

        try {
            // Prepare user data
            const userData = {
                nickname: formData.nickname,
                password: formData.password,
                interests: formData.interests,
                avatar_base64: null,
                avatar_mimeType: null
            };

            // Convert image to Base64 if exists
            if (formData.avatar) {
                const base64Data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(formData.avatar);
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                });
                // Split metadata from data (e.g. "data:image/jpeg;base64,.....")
                const [meta, data] = base64Data.split(',');
                userData.avatar_base64 = data;
                userData.avatar_mimeType = meta.match(/:(.*?);/)[1];
            }

            console.log("Registering with:", userData);
            const result = await api.registerUser(userData);

            if (result.status === 'error') {
                throw new Error(result.message);
            }

            console.log("Registration success:", result);
            navigate("/login");
        } catch (error) {
            console.error("Registration failed:", error);
            alert("Registration failed: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FDFCFD] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-indigo-100/50 border border-gray-100 p-6 sm:p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                        Join Knowly
                    </h1>
                    <p className="text-gray-500 mt-2">Start your knowledge journey today</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <AvatarUpload
                        preview={null}
                        onChange={(file) => setFormData({ ...formData, avatar: file })}
                        className="mb-8"
                    />

                    <Input
                        label="Nickname"
                        placeholder="e.g. CuriosityWalker"
                        icon={User}
                        value={formData.nickname}
                        onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                        required
                    />

                    <Input
                        label="Password"
                        type="password"
                        placeholder="••••••••"
                        icon={Lock}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                    />

                    <InterestInput
                        interests={formData.interests}
                        onChange={(interests) => setFormData({ ...formData, interests })}
                        onBeforeAdd={handleBeforeAddInterest}
                    />

                    <div className="pt-4">
                        <Button
                            type="submit"
                            className="w-full"
                            isLoading={loading}
                            size="lg"
                        >
                            create account
                        </Button>
                    </div>

                    <p className="text-center text-sm text-gray-500">
                        Already have an account?{" "}
                        <Link to="/login" className="text-indigo-600 font-medium hover:text-indigo-700 hover:underline">
                            Log in
                        </Link>
                    </p>
                </form>
            </div>

            {refiningInterest && (
                <RefineInterestModal
                    initialInterest={refiningInterest}
                    onClose={() => setRefiningInterest(null)}
                    onComplete={handleRefinementComplete}
                />
            )}
        </div>
    );
};

export default SignupPage;
