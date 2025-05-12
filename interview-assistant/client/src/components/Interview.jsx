import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import axios from 'axios';

const Interview = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [questions, setQuestions] = useState([
    "How Would You Handle a Situation Where a Project You're Working on Is Behind Schedule?",
    "How Do You Handle Feedback and Criticism of Your Code?"
  ]);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState('Ready');
  const [lastResponse, setLastResponse] = useState(null);

  // listen
  useEffect(() => {
    if (!currentSessionId) {
      console.log("⏳ Waiting for session ID");
      return;
    }
  
    console.log("🔄 Setting up Firestore listener for chunks in session:", currentSessionId);
    
    // query chunks collection
    const chunksRef = collection(db, 'transcripts', currentSessionId, 'chunks');
    const chunksQuery = query(chunksRef, orderBy('timestamp', 'desc'));
  
    const unsubscribe = onSnapshot(chunksQuery, (snapshot) => {
      console.log(`📥 Received chunks snapshot with ${snapshot.docChanges().length} changes`);
      
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          console.log("📄 New chunk added:", data);
          
          if (data.type === 'llm_response') {
            console.log("🤖 Processing LLM response:", data.reply);
            
            // get response content
            const questionMatch = data.content.match(/QUESTION:\s*"([^"]+)"/);
            if (questionMatch) {
              const newQuestion = questionMatch[1].trim();
              console.log("📝 Extracted question:", newQuestion);
              
              setQuestions(prevQuestions => {
                console.log("✅ Adding new question to list:", newQuestion);
                return [...prevQuestions, newQuestion];
              });
            } else {
              console.log("⚠️ No question found in response:", data.content);
            }
          }
        }
      });
    }, (error) => {
      console.error("❌ Firestore listener error:", error);
    });
  
    return () => {
      console.log("🧹 Cleaning up listener");
      unsubscribe();
    };
  }, [currentSessionId]);

  const startInterview = async () => {
    try {
      setApiStatus('Starting recording...');
      setIsRecording(true);
  
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/start-recording`);
      
      const sessionId = response.data.session_id;
      if (!sessionId) {
        throw new Error('No session ID returned from server');
      }
      
      setCurrentSessionId(sessionId);
      console.log('Recording started with session ID:', sessionId);
      setApiStatus('Recording started - waiting for first question...');
      setError(null);
    } catch (error) {
      console.error('Start recording error:', error);
      setError(`Failed to start recording: ${error.message}`);
      setApiStatus(`Error: ${error.message}`);
      setIsRecording(false); 
    }
  };

  const stopInterview = async () => {
    try {
      setApiStatus('Stopping recording...');
      await axios.post(`${import.meta.env.VITE_API_URL}/stop-recording`);
      setIsRecording(false);
      setApiStatus('Recording stopped');
    } catch (error) {
      console.error('Stop recording error:', error);
      setError(`Failed to stop recording: ${error.message}`);
      setApiStatus(`Error: ${error.message}`);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>Interview Questions</h1>
      
      <div style={{ margin: '20px 0', textAlign: 'center' }}>
        <button 
          onClick={isRecording ? stopInterview : startInterview}
          style={{
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            background: isRecording ? '#f44336' : '#4CAF50',
            color: 'white',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          {isRecording ? 'Stop Interview' : 'Start Interview'}
        </button>
      </div>


      <div style={{
        margin: '10px 0',
        padding: '10px',
        background: '#e3f2fd',
        borderRadius: '4px'
      }}>
        <strong>Status:</strong> {apiStatus}
        {lastResponse && (
          <div style={{ marginTop: '5px', fontSize: '14px' }}>
            <strong>Last Transcript:</strong> {lastResponse}
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div style={{
          color: '#f44336',
          padding: '10px',
          margin: '10px 0',
          background: '#ffebee',
          borderRadius: '4px',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      {/* Questions display */}
      <div style={{ marginTop: '30px' }}>
        {questions.map((question, index) => (
          <div 
            key={index} 
            style={{
              background: '#f8f9fa',
              borderRadius: '8px',
              padding: '15px',
              margin: '10px 0',
              position: 'relative',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ fontSize: '16px' }}>{question}</div>
            {index >= 2 && (
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: '#646cff',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '12px'
              }}>
                AI Suggested
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Interview;