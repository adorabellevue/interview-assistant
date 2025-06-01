import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import axios from 'axios';
import QuestionRow from '../components/QuestionRow'; // Assuming QuestionRow.jsx is in components
import useInterviewStore from '../store/interviewStore';

const LivePage = () => {
  // Select data needed for rendering directly
  const liveQuestions = useInterviewStore((state) => state.liveQuestions);
  
  // Actions will be called via useInterviewStore.getState().actionName() in handlers
  // to avoid issues with selector stability causing re-renders.

  const [isRecording, setIsRecording] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [error, setError] = useState(null); // Local error for this page's operations
  const [apiStatus, setApiStatus] = useState('Ready');

  useEffect(() => {
    if (!currentSessionId) {
      console.log("LivePage: Waiting for session ID");
      return;
    }

    console.log("LivePage: Setting up Firestore listener for session:", currentSessionId);
    const chunksRef = collection(db, 'transcripts', currentSessionId, 'chunks');
    const chunksQuery = query(chunksRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(chunksQuery, (snapshot) => {
      console.log(`LivePage: Chunks snapshot with ${snapshot.docChanges().length} changes`);
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data.type === 'llm_response') {
            const questionMatch = data.content.match(/QUESTION:\s*"([^"]+)"/);
            if (questionMatch) {
              const newQuestion = questionMatch[1].trim();
              console.log("LivePage: Extracted question:", newQuestion);
              useInterviewStore.getState().addLiveQuestion(newQuestion);
            }
          }
        }
      });
    }, (err) => {
      console.error("LivePage: Firestore listener error:", err);
      setError(`Firestore error: ${err.message}`);
    });

    return () => {
      console.log("LivePage: Cleaning up Firestore listener");
      unsubscribe();
    };
  }, [currentSessionId]);

  const startInterview = async () => {
    useInterviewStore.getState().clearLiveSession();
    useInterviewStore.getState().setResultsLoading();
    // Also clear any previous results from the store directly
    useInterviewStore.getState().clearResults(); 

    setError(null);
    setApiStatus('Starting recording...');
    setIsRecording(true);
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/start-recording`);
      const sessionId = response.data.session_id;
      if (!sessionId) throw new Error('No session ID returned');
      setCurrentSessionId(sessionId);
      setApiStatus('Recording started - waiting for questions...');
    } catch (err) {
      console.error('Start recording error:', err);
      const errorMsg = err.response?.data?.error || err.message;
      setError(`Failed to start: ${errorMsg}`);
      setApiStatus(`Error: ${errorMsg}`);
      setIsRecording(false);
      useInterviewStore.getState().setResultsError(errorMsg);
    }
  };

  const stopInterview = async () => {
    if (!currentSessionId) return;
    setApiStatus('Stopping recording...');
    useInterviewStore.getState().setResultsLoading();
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/stop-recording`, {
        session_id: currentSessionId
      });
      setIsRecording(false);
      setApiStatus('Recording stopped. Processing results...');
      const transcript = response.data.transcript;
      if (transcript) {
        const summaryResponse = await axios.post(`${import.meta.env.VITE_API_URL}/summarize-transcript`, {
          transcript: transcript
        });
        useInterviewStore.getState().setResults({
          transcript: transcript,
          summary: summaryResponse.data.summary || 'Summary not available.'
        });
        setApiStatus('Results processed.');
      } else {
        setError("No transcript received.");
        useInterviewStore.getState().setResultsError("No transcript received.");
        setApiStatus('Error: No transcript.');
      }
    } catch (err) {
      console.error('Stop recording error:', err);
      const errorMsg = err.response?.data?.error || err.message;
      setError(`Failed to stop: ${errorMsg}`);
      setApiStatus(`Error: ${errorMsg}`);
      useInterviewStore.getState().setResultsError(errorMsg);
    }
    setCurrentSessionId(null);
  };

  return (
    <div className="p-4 md:p-8 bg-gray-100 min-h-screen">
      <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-lg p-6 md:p-8">
        <h1 className="text-3xl font-bold mb-8 text-center text-gray-800 border-b pb-4">Live Interview</h1>
        
        <div className="controls my-6 p-6 bg-slate-50 rounded-lg shadow-md">
          <div className="flex flex-col sm:flex-row justify-around items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <button 
              onClick={startInterview} 
              disabled={isRecording} 
              className="w-full sm:w-auto px-8 py-3 text-lg font-semibold text-white bg-green-500 rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-150 ease-in-out shadow-md hover:shadow-lg"
            >
              Start Session
            </button>
            <button 
              onClick={stopInterview} 
              disabled={!isRecording || !currentSessionId}
              className="w-full sm:w-auto px-8 py-3 text-lg font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-150 ease-in-out shadow-md hover:shadow-lg"
            >
              Stop Session
            </button>
          </div>
          {error && <p className="text-red-600 mt-4 text-center font-medium">Error: {error}</p>}
          <p className="text-center mt-4 text-gray-700">Status: {apiStatus}</p>
          {isRecording && <p className="text-blue-600 font-semibold mt-2 text-center animate-pulse">▶ Recording in progress... Speak now!</p>}
        </div>

        {isRecording && liveQuestions.length > 0 && (
          <div className="questions-container mt-10 p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-2xl font-semibold mb-6 text-gray-800">AI Suggested Follow-up Questions:</h3>
            <ul className="space-y-4">
              {liveQuestions.map((q, index) => (
                <QuestionRow key={index} question={q} index={index} />
              ))}
            </ul>
          </div>
        )}
        {!isRecording && liveQuestions.length > 0 && apiStatus === 'Ready' && (
             <div className="mt-10 p-6 bg-yellow-50 border border-yellow-300 rounded-lg shadow-md">
                <p className="text-center text-yellow-700 font-medium">Interview session not started. Previous questions are shown. Click "Start Session" to begin a new interview.</p>
             </div>
        )}
      </div>
    </div>
  );
};

export default LivePage; 