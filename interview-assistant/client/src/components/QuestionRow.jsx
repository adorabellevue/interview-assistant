import React from 'react';
import useInterviewStore from '../store/interviewStore'; // Import the store
import axios from 'axios'; // Make sure axios is imported
// import { CheckIcon, XMarkIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/solid'; // Or outline

const QuestionRow = ({ question, index }) => {
  // Removed direct selector for dismissQuestion to use getState() in handler

  const handleDismiss = async () => {
    const questionToDismiss = question.text;
    useInterviewStore.getState().dismissQuestion(questionToDismiss);
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL;
      if (!apiUrl) {
        console.error("VITE_API_URL is not defined. Cannot blacklist question.");
        return;
      }
      await axios.post(`${apiUrl}/api/blacklist-question`, { 
        questionText: questionToDismiss 
      });
      console.log(`Dismissed and requested blacklist for: ${questionToDismiss}`);
    } catch (error) {
      console.error("Error blacklisting question:", error.response ? error.response.data : error.message);
      // Optionally, inform the user or handle the error in UI if desired
    }
  };

  const handleTogglePin = () => {
    useInterviewStore.getState().togglePinQuestion(question.text); // Ensure question.text is passed
  };

  return (
    <li className={`relative p-4 border rounded-md shadow-sm flex justify-between items-center ${question.pinned ? 'bg-sky-100 border-sky-300' : 'bg-sky-50 border-sky-200'}`}>
      <span 
        className={`absolute top-2 right-2 px-2 py-0.5 text-xs font-semibold text-white rounded-full ${question.pinned ? 'bg-blue-600' : 'bg-sky-500'}`}>
        {question.pinned ? 'Pinned' : 'AI Suggested'}
      </span>
      
      <div className="flex-grow mr-4 pr-12">
        <span className="font-medium text-gray-800">{index + 1}. {question.text}</span>
      </div>
      
      <div className="flex items-center flex-shrink-0">
        <button aria-label="Mark as helpful" className="p-2 text-green-600 hover:bg-green-100 rounded-full transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </button>
        <button 
          onClick={handleTogglePin} 
          aria-label={question.pinned ? "Unpin question" : "Pin question"} 
          className={`p-2 rounded-full transition-colors ${question.pinned ? 'text-blue-700 bg-blue-200 hover:bg-blue-300' : 'text-blue-600 hover:bg-blue-100'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            {question.pinned ? (
              // Filled circle for PINNED state
              <circle cx="12" cy="12" r="8" strokeWidth={1.5} stroke="currentColor" fill="currentColor" />
            ) : (
              // Outline circle for UNPINNED state
              <circle cx="12" cy="12" r="8" strokeWidth={1.5} stroke="currentColor" fill="none" />
            )}
          </svg>
        </button>
        <button 
          onClick={handleDismiss} 
          aria-label="Dismiss question" 
          className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-colors"
        >
          {/* Placeholder for XMarkIcon */}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </button>
      </div>
    </li>
  );
};

export default QuestionRow; 