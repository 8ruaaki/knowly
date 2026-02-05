import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage';

import DashboardPage from './pages/DashboardPage';
import FindFriendsPage from './pages/FindFriendsPage';
import MyPage from './pages/MyPage';
import QuizPage from './pages/QuizPage';


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        {/* Default redirect to login for now, or dashboard if we had auth state */}
        <Route path="/" element={<DashboardPage />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/search" element={<FindFriendsPage />} />
        <Route path="/quiz/:topic" element={<QuizPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
