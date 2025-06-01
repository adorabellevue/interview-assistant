import React, { useState } from 'react';
import axios from 'axios';
// We might need to create a specific CSS file for UploadPage or reuse/adapt existing ones.
// For now, let's assume some styles will be inherited or we'll use Tailwind directly.
// import '../components/InitialQuestions.css'; // If you want to reuse styles

const UploadPage = () => {
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [initialQuestions, setInitialQuestions] = useState([]);
  const [processingInitialQuestions, setProcessingInitialQuestions] = useState(false);
  const [initialQuestionsError, setInitialQuestionsError] = useState(null);

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
    // Server expects job_description.txt, so create a blob with that name
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

  return (
    <div className="p-4 md:p-8 bg-white shadow-lg rounded-lg">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-3">Generate Initial Interview Questions</h1>
      
      <div className="space-y-6">
        <div className="form-group">
          <label htmlFor="resumeUpload" className="block text-lg font-medium text-gray-700 mb-1">Upload Resume (PDF only):</label>
          <div className="mt-1 flex items-center">
            <label htmlFor="resumeUpload" className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-md transition duration-150 ease-in-out disabled:opacity-50">
              Choose File
            </label>
            <input 
              type="file" 
              id="resumeUpload" 
              accept=".pdf" 
              onChange={handleResumeChange} 
              disabled={processingInitialQuestions}
              className="sr-only" // screen-reader only, label acts as button
            />
            <span className="ml-3 text-gray-600">
              {resumeFile ? resumeFile.name : 'No file chosen'}
            </span>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="jobDescription" className="block text-lg font-medium text-gray-700 mb-1">Job Description:</label>
          <textarea 
            id="jobDescription" 
            value={jobDescription} 
            onChange={handleJobDescriptionChange} 
            placeholder="Paste the job description here..." 
            rows="10"
            disabled={processingInitialQuestions}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 text-gray-900"
          />
        </div>

        <button 
          onClick={handleSubmitInitialQuestions} 
          disabled={processingInitialQuestions || !resumeFile || !jobDescription.trim()}
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium 
                     text-gray-800  // Default dark text
                     bg-green-600 hover:bg-green-700 text-white // Enabled state: green bg, white text
                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 
                     disabled:bg-gray-400 disabled:text-gray-700 disabled:cursor-not-allowed 
                     transition duration-150 ease-in-out"
        >
          {processingInitialQuestions ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-gray-800">Generating...</span> {/* Explicitly dark text for "Generating..." */}
            </>
          ) : (
            'Generate Initial Questions'
          )}
        </button>

        {initialQuestionsError && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
            {initialQuestionsError}
          </div>
        )}

        {initialQuestions.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-semibold text-gray-800">Generated Initial Questions:</h3>
                <button 
                    onClick={handleDownloadInitialQuestions}
                    className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium 
                               text-gray-800 // Default dark text
                               bg-indigo-600 hover:bg-indigo-700 text-white // Enabled state: indigo bg, white text
                               focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 
                               transition duration-150 ease-in-out"
                >
                    Download Questions
                </button>
            </div>
            <ul className="space-y-3">
              {initialQuestions.map((question, index) => (
                <li key={index} className="p-4 bg-gray-50 border border-gray-200 rounded-md shadow-sm text-gray-700">
                  {index + 1}. {question}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadPage; 