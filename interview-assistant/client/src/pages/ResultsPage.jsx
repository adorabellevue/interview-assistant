import React, { useState } from 'react';
import useInterviewStore from '../store/interviewStore';
import { ArrowDownTrayIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

const PREVIEW_LENGTH = 300; // Characters to show in preview

const ResultsPage = () => {
  // Select state individually for stability
  const transcript = useInterviewStore((state) => state.transcript);
  const summary = useInterviewStore((state) => state.summary);
  const isLoadingResults = useInterviewStore((state) => state.isLoadingResults);
  const resultsError = useInterviewStore((state) => state.resultsError);

  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);

  const toggleSummary = () => setIsSummaryExpanded(!isSummaryExpanded);
  const toggleTranscript = () => setIsTranscriptExpanded(!isTranscriptExpanded);

  const downloadContent = (content, filename) => {
    if (!content) return;
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain;charset=utf-8'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
    document.body.removeChild(element);
  };

  const downloadSummary = () => {
    downloadContent(summary, "interview_summary.txt");
  };

  const downloadTranscript = () => {
    downloadContent(transcript, "interview_transcript.txt");
  };

  const renderCollapsibleSection = (title, content, isExpanded, toggleFunction, titleColorClass = 'text-gray-700', bgColorClass = 'bg-gray-50', borderColorClass = 'border-gray-200') => {
    if (!content) return null;

    const isLongContent = content.length > PREVIEW_LENGTH;
    const displayText = isExpanded || !isLongContent ? content : `${content.substring(0, PREVIEW_LENGTH)}...`;

    return (
      <div className={`content-section p-6 ${bgColorClass} rounded-lg shadow-md border ${borderColorClass}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-2xl font-semibold ${titleColorClass}`}>{title}</h3>
          {isLongContent && (
            <button 
              onClick={toggleFunction} 
              className={`p-1.5 rounded-full hover:bg-gray-200 transition-colors text-gray-600`}
              aria-expanded={isExpanded}
            >
              {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
              <span className="sr-only">{isExpanded ? 'Show less' : 'Show more'}</span>
            </button>
          )}
        </div>
        <p className="text-gray-700 whitespace-pre-wrap text-base leading-relaxed">{displayText}</p>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 bg-gray-100 min-h-screen">
      <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-lg p-6 md:p-8">
        <h1 className="text-3xl font-bold mb-8 text-center text-gray-800 border-b pb-4">Interview Results</h1>

        {isLoadingResults && (
          <div className="text-center py-10">
            <p className="text-lg text-gray-600">Loading results...</p>
            {/* You could add a spinner here */}
          </div>
        )}

        {resultsError && (
          <div className="error-message p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg mb-6 shadow">
            <h3 className="font-semibold text-lg mb-2">Error Loading Results</h3>
            <p>{typeof resultsError === 'string' ? resultsError : JSON.stringify(resultsError)}</p>
          </div>
        )}

        {!isLoadingResults && !resultsError && !transcript && !summary && (
          <div className="text-center py-10 px-6 text-gray-500 bg-yellow-50 border border-yellow-300 rounded-lg shadow-sm">
            <p className="text-lg">No interview results to display.</p>
            <p className="mt-2">Complete an interview session on the 'Live Interview' page to see your results here.</p>
          </div>
        )}

        {!isLoadingResults && !resultsError && (transcript || summary) && (
          <div className="results-content space-y-8">
            {summary && (
              <div className="summary-section space-y-4">
                {renderCollapsibleSection("Interview Summary", summary, isSummaryExpanded, toggleSummary, 'text-green-700', 'bg-green-50', 'border-green-200')}
                <button 
                  onClick={downloadSummary}
                  className="mt-2 flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400"
                  disabled={!summary}
                >
                  <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
                  Download Summary
                </button>
              </div>
            )}

            {transcript && (
              <div className="transcript-section space-y-4">
                {renderCollapsibleSection("Full Transcript", transcript, isTranscriptExpanded, toggleTranscript, 'text-blue-700', 'bg-blue-50', 'border-blue-200')}
                <button 
                  onClick={downloadTranscript}
                  className="mt-2 flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
                  disabled={!transcript}
                >
                  <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
                  Download Transcript
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsPage; 