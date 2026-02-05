import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Lock } from "lucide-react";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { api } from "../api";

const LoginPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        nickname: "",
        password: "",
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            console.log("Logging in with:", formData);
            const result = await api.loginUser(formData);

            if (result.status === 'success') {
                console.log("Login success:", result);
                // Store user info
                localStorage.setItem('user', JSON.stringify(result));
                navigate("/");
            } else {
                throw new Error(result.message || "Login failed");
            }
        } catch (error) {
            console.error("Login failed:", error);
            alert("Login failed: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FDFCFD] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-indigo-100/50 border border-gray-100 p-6 sm:p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                        Welcome Back
                    </h1>
                    <p className="text-gray-500 mt-2">Continue your quest for knowledge</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input
                        label="Nickname"
                        placeholder="Your nickname"
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

                    <div className="flex items-center justify-end">
                        <Link to="#" className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline">
                            Forgot password?
                        </Link>
                    </div>

                    <div className="pt-2">
                        <Button
                            type="submit"
                            className="w-full"
                            isLoading={loading}
                            size="lg"
                        >
                            Log In
                        </Button>
                    </div>

                    <p className="text-center text-sm text-gray-500">
                        Don't have an account?{" "}
                        <Link to="/signup" className="text-indigo-600 font-medium hover:text-indigo-700 hover:underline">
                            Sign up
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
