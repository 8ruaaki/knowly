import React from 'react';

const QuizCard = ({ quiz, onAnswer }) => {
    return (
        <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-xl max-w-sm w-full animate-fade-in-up">
            <h2 className="text-xl font-bold text-gray-800 mb-4">{quiz.question}</h2>
            <div className="space-y-3">
                {quiz.options.map((option, index) => (
                    <button
                        key={index}
                        onClick={() => onAnswer(index)}
                        className="w-full text-left p-3 rounded-xl bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 transition-all duration-200 text-gray-700 font-medium"
                    >
                        {option}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default QuizCard;
