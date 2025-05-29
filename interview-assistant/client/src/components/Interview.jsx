import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import axios from 'axios';
import './InitialQuestions.css'; // Import new CSS

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
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [initialQuestions, setInitialQuestions] = useState([]);
  const [processingInitialQuestions, setProcessingInitialQuestions] = useState(false);
  const [initialQuestionsError, setInitialQuestionsError] = useState(null);
  const [summary, setSummary] = useState(null);

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

  const handleResumeChange = (event) => {
    setResumeFile(event.target.files[0]);
    setInitialQuestionsError(null); // Clear previous errors
  };

  const handleJobDescriptionChange = (event) => {
    setJobDescription(event.target.value);
    setInitialQuestionsError(null); // Clear previous errors
  };

  const handleSubmitInitialQuestions = async () => {
    if (!resumeFile || !jobDescription.trim()) {
      setInitialQuestionsError('Please upload a resume (PDF) and provide a job description.');
      return;
    }
    if (resumeFile.type !== 'application/pdf') {
      setInitialQuestionsError('Resume must be a PDF file.');
      return;
    }

    setProcessingInitialQuestions(true);
    setInitialQuestionsError(null);
    setInitialQuestions([]); // Clear previous questions

    const formData = new FormData();
    formData.append('resume', resumeFile);
    formData.append('jobDescription', new Blob([jobDescription], { type: 'text/plain' }), 'job_description.txt');

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/process-documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setInitialQuestions(response.data.questions || []);
      if (!response.data.questions || response.data.questions.length === 0) {
        setInitialQuestionsError('No questions were generated. The LLM might have returned an empty list or an unexpected response.');
      }
    } catch (err) {
      console.error('Error processing documents:', err);
      const errorMsg = err.response && err.response.data && err.response.data.error 
                       ? err.response.data.error 
                       : err.message;
      setInitialQuestionsError(`Failed to generate initial questions: ${errorMsg}`);
      setInitialQuestions([]); // Clear any partial questions
    }
    setProcessingInitialQuestions(false);
  };

  const handleDownloadInitialQuestions = () => {
    if (initialQuestions.length === 0) {
      alert('No questions to download.');
      return;
    }
    const fileContent = initialQuestions.join('\n\n');
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'initial_interview_questions.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Start interview
  const startInterview = async () => {
    try {
      setQuestions([
        "How Would You Handle a Situation Where a Project You're Working on Is Behind Schedule?",
        "How Do You Handle Feedback and Criticism of Your Code?"
      ]);
      setLastResponse(null);
      setSummary(null);
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

  // Stop interview
  const stopInterview = async () => {
    try {
      setApiStatus('Stopping recording...');
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/stop-recording`, {
        session_id: currentSessionId
      });
      setIsRecording(false);
      setApiStatus('Recording stopped');

      const transcript = response.data.transcript;
      if (transcript) {
        console.log("Full transcript:", transcript);
        setLastResponse(transcript);

        // Send to Gemini for summary
        const summaryResponse = await axios.post(`${import.meta.env.VITE_API_URL}/summarize-transcript`, {
          transcript: transcript
        });
        setSummary(summaryResponse.data.summary);
      }
    } catch (error) {
      console.error('Stop recording error:', error);
      setError(`Failed to stop recording: ${error.message}`);
      setApiStatus(`Error: ${error.message}`);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      {/* Initial Question Generation Section */}
      <div className="initial-questions-container">
        <h2>Generate Initial Interview Questions</h2>
        <div className="form-group">
          <label htmlFor="resumeUpload">Upload Resume (PDF only):</label>
          <div className="custom-file-input-wrapper">
            <input 
              type="file" 
              id="resumeUpload" 
              accept=".pdf" 
              onChange={handleResumeChange} 
              disabled={processingInitialQuestions}
              className="visually-hidden-input"
            />
            <label htmlFor="resumeUpload" className="custom-file-input-button">
              Choose File
            </label>
            <span className="custom-file-input-name">
              {resumeFile ? resumeFile.name : 'No file chosen'}
            </span>
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="jobDescription">Job Description:</label>
          <textarea 
            id="jobDescription" 
            value={jobDescription} 
            onChange={handleJobDescriptionChange} 
            placeholder="Paste the job description here..." 
            rows="8"
            disabled={processingInitialQuestions}
          />
        </div>
        <button 
          onClick={handleSubmitInitialQuestions} 
          disabled={processingInitialQuestions || !resumeFile || !jobDescription.trim()}
          className="submit-initial-questions-btn"
        >
          {processingInitialQuestions ? 'Generating...' : 'Generate Initial Questions'}
        </button>

        {initialQuestionsError && (
          <div className="initial-questions-error">{initialQuestionsError}</div>
        )}

        {initialQuestions.length > 0 && (
          <div className="initial-questions-display">
            <h3>Generated Initial Questions:</h3>
            {initialQuestions.map((question, index) => (
              <div key={index} className="initial-question-item">
                {question}
              </div>
            ))}
            <button 
              onClick={handleDownloadInitialQuestions} 
              className="download-questions-btn"
              style={{ marginTop: '15px' }}
            >
              Download Questions
            </button>
          </div>
        )}
      </div>

      {/* Existing Interview Section Separator (Optional) */}
      <hr style={{ margin: '40px 0' }} /> 

      <h1>Real-time Interview Practice</h1>
      
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
            <div style={{ fontSize: '16px', color: '#213547' }}>{question}</div>
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

      {/* End of interview display*/}
      {lastResponse && (
        <>
          <h1 style={{ marginBottom: '10px' }}>End of Interview Summary</h1>
          <div style={{ display: 'flex', gap: '20px' }}>
            {/* Full Transcript */}
            <div style={{ flex: 1, whiteSpace: 'pre-wrap', padding: '20px', borderRadius: '8px' }}>
              <h3>Full Transcript</h3>
              <p>{lastResponse}</p>
            </div>

            {/* Summary */}
            <div style={{ flex: 1, whiteSpace: 'pre-wrap', padding: '20px', borderRadius: '8px' }}>
              <h3>Summary</h3>
              {summary ? <p>{summary}</p> : <p>Generating summary...</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Interview;