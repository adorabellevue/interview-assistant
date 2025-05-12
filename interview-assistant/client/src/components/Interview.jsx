import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import axios from 'axios';

const Interview = () => {
  const { currentUser } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [questions, setQuestions] = useState([
    "How Would You Handle a Situation Where a Project You're Working on Is Behind Schedule?",
    "How Do You Handle Feedback and Criticism of Your Code?"
  ]);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState('Ready');
  const [lastResponse, setLastResponse] = useState(null);

  const startInterview = async () => {
    try {
      setApiStatus('Starting recording...');
      setIsRecording(true);
      const response = await axios.post('http://localhost:5001/start-recording');
      console.log('Start recording response:', response.data);
      setApiStatus('Recording started - waiting for first question...');
      setLastResponse(response.data.message);
    } catch (error) {
      console.error('Start recording error:', error);
      setError('Failed to start recording');
      setApiStatus(`Error: ${error.message}`);
    }
  };

  const stopInterview = async () => {
    try {
      setApiStatus('Stopping recording...');
      setIsRecording(false);
      const response = await axios.post('http://localhost:5001/stop-recording');
      console.log('Stop recording response:', response.data);
      setApiStatus('Recording stopped');
      setLastResponse(response.data.message);
      setCurrentSessionId(null);
    } catch (error) {
      console.error('Stop recording error:', error);
      setError('Failed to stop recording');
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
        <strong>API Status:</strong> {apiStatus}
        {lastResponse && (
          <div style={{ marginTop: '5px', fontSize: '14px' }}>
            <strong>Last Response:</strong> {lastResponse}
          </div>
        )}
      </div>

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