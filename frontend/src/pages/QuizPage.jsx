import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api';
import { ArrowLeft, CheckCircle, XCircle, Unlock, Award } from 'lucide-react';

const QuizPage = () => {
    const { topic } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    // Parse Level
    const searchParams = new URLSearchParams(location.search);
    const level = parseInt(searchParams.get('level') || '1', 10);

    // State
    const [loading, setLoading] = useState(true);
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState(null); // Index of selected option
    const [isAnswered, setIsAnswered] = useState(false);
    const [score, setScore] = useState(0);
    const [showResults, setShowResults] = useState(false);
    const [error, setError] = useState(null);
    const [unlockedNext, setUnlockedNext] = useState(false);
    const [saving, setSaving] = useState(false);
    const [correctlyAnswered, setCorrectlyAnswered] = useState([]);

    const [badgeEarned, setBadgeEarned] = useState(false);

    const fetchedRef = React.useRef(false);

    useEffect(() => {
        const fetchQuiz = async () => {
            if (fetchedRef.current) return;
            fetchedRef.current = true;

            try {
                // Remove '#' if present in param
                const cleanTopic = topic.replace('#', '');
                const savedUser = localStorage.getItem('user');
                const userId = savedUser ? JSON.parse(savedUser).user_id : 'guest';

                const res = await api.getQuiz(userId, cleanTopic, level);

                if (res.status === 'success' && res.questions) {
                    setQuestions(res.questions);
                } else {
                    setError(res.message || "Failed to generate quiz.");
                }
            } catch (err) {
                console.error(err);
                setError("Network error or timeout.");
            } finally {
                setLoading(false);
            }
        };

        if (topic) fetchQuiz();
    }, [topic, level]);

    useEffect(() => {
        if (showResults) {
            const saveProgress = async () => {
                setSaving(true);
                const cleanTopic = topic.replace('#', '');
                const savedUser = localStorage.getItem('user');
                const userId = savedUser ? JSON.parse(savedUser).user_id : 'guest';

                // Send correctly answered questions to backend even if level isn't unlocked
                const res = await api.updateProgress(userId, cleanTopic, level, score, correctlyAnswered);

                if (res.status === 'success') {
                    if (res.unlocked) setUnlockedNext(true);
                    if (res.badge_awarded) setBadgeEarned(true);
                }
                setSaving(false);
            };
            saveProgress();
        }
    }, [showResults, score, topic, level, correctlyAnswered]);

    const handleOptionClick = (index) => {
        if (isAnswered) return;

        setSelectedOption(index);
        setIsAnswered(true);

        const currentQ = questions[currentIndex];
        if (index === currentQ.correct_index) {
            setScore(s => s + 1);
            setCorrectlyAnswered(prev => [...prev, currentQ.question]);
        }
    };

    const handleNext = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(i => i + 1);
            setSelectedOption(null);
            setIsAnswered(false);
        } else {
            setShowResults(true);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-indigo-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                <h2 className="text-xl font-bold text-gray-800">Generating Level {level} Quiz...</h2>
                <p className="text-gray-500 mt-2">Topic: {topic}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-indigo-50 flex flex-col items-center justify-center p-6 text-center">
                <h2 className="text-xl font-bold text-red-600 mb-2">Oops!</h2>
                <p className="text-gray-600 mb-6">{error}</p>
                <button onClick={() => navigate('/')} className="px-6 py-2 bg-white rounded-full shadow-sm font-medium text-gray-700">
                    Back to Dashboard
                </button>
            </div>
        );
    }

    if (showResults) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm animate-pop-in">
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Quiz Complete!</h1>
                    <p className="text-gray-500 mb-1">Topic: {topic}</p>
                    <p className="text-indigo-600 font-bold mb-6">Level {level}</p>

                    <div className="text-6xl font-black text-indigo-600 mb-4">
                        {score}/{questions.length}
                    </div>

                    {badgeEarned && (
                        <div className="mb-6 p-6 bg-yellow-100 border-2 border-yellow-400 rounded-xl animate-bounce shadow-xl">
                            <div className="flex flex-col items-center justify-center gap-2 text-yellow-800 font-bold">
                                <div className="p-3 bg-yellow-500 rounded-full text-white shadow-lg">
                                    <Award size={40} strokeWidth={3} />
                                </div>
                                <span className="text-xl">MASTER BADGE EARNED!</span>
                                <span className="text-sm font-normal opacity-80">You mastered Level 10!</span>
                            </div>
                        </div>
                    )}

                    {!badgeEarned && unlockedNext && (
                        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl animate-bounce">
                            <div className="flex items-center justify-center gap-2 text-yellow-700 font-bold">
                                <Unlock size={24} />
                                <span>Level {level + 1} Unlocked!</span>
                            </div>
                        </div>
                    )}

                    <p className="text-lg font-medium text-gray-700 mb-8">
                        {score === 5 ? "Perfect Score! 🎉" :
                            score >= 3 ? "Great Job! 👍" : "Keep Learning! 💪"}
                    </p>

                    <button
                        onClick={() => navigate('/')}
                        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const currentQuestion = questions[currentIndex];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm flex items-center justify-between gap-4">
                <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 shrink-0">
                    <XCircle size={24} />
                </button>
                <div className="flex flex-col items-center flex-1 min-w-0">
                    <span className="font-bold text-gray-800 text-lg truncate w-full text-center">#{topic}</span>
                    <span className="text-xs font-medium text-indigo-500 shrink-0">Level {level}</span>
                </div>
                <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full shrink-0">
                    {currentIndex + 1} / {questions.length}
                </span>
            </div>

            {/* Question Area */}
            <div className="flex-1 p-6 flex flex-col max-w-lg mx-auto w-full">
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-gray-800 leading-relaxed">
                        {currentQuestion.question}
                    </h2>
                </div>

                {/* Options */}
                <div className="space-y-3 flex-1">
                    {currentQuestion.options.map((option, idx) => {
                        let btnClass = "w-full p-4 rounded-xl text-left font-medium transition-all duration-200 border-2 ";

                        if (isAnswered) {
                            if (idx === currentQuestion.correct_index) {
                                btnClass += "bg-green-100 border-green-500 text-green-800";
                            } else if (idx === selectedOption) {
                                btnClass += "bg-red-100 border-red-500 text-red-800";
                            } else {
                                btnClass += "bg-gray-50 border-transparent text-gray-400 opacity-50";
                            }
                        } else {
                            btnClass += "bg-white border-transparent shadow-sm hover:border-indigo-200 hover:bg-indigo-50 text-gray-700";
                        }

                        return (
                            <button
                                key={idx}
                                onClick={() => handleOptionClick(idx)}
                                disabled={isAnswered}
                                className={btnClass}
                            >
                                <div className="flex items-center justify-between">
                                    <span>{option}</span>
                                    {isAnswered && idx === currentQuestion.correct_index && (
                                        <CheckCircle size={20} className="text-green-600" />
                                    )}
                                    {isAnswered && idx === selectedOption && idx !== currentQuestion.correct_index && (
                                        <XCircle size={20} className="text-red-600" />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Feedback & Next Button */}
                {isAnswered && (
                    <div className="mt-6 animate-fade-in-up">
                        <div className={`p-4 rounded-xl mb-4 ${selectedOption === currentQuestion.correct_index
                            ? 'bg-green-50 text-green-800'
                            : 'bg-red-50 text-red-800'
                            }`}>
                            <p className="font-bold mb-1">
                                {selectedOption === currentQuestion.correct_index ? "Correct!" : "Incorrect..."}
                            </p>
                            <p className="text-sm opacity-90">{currentQuestion.explanation}</p>
                        </div>

                        <button
                            onClick={handleNext}
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                        >
                            {currentIndex < questions.length - 1 ? "Next Question" : "See Results"}
                            <ArrowLeft size={20} className="rotate-180" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuizPage;
