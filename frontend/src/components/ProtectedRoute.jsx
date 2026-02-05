import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
    // Check if user data exists in localStorage
    const savedUser = localStorage.getItem('user');

    // If not authenticated, redirect to login
    if (!savedUser) {
        return <Navigate to="/login" replace />;
    }

    // If authenticated, render user content
    return children;
};

export default ProtectedRoute;
