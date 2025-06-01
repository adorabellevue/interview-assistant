import { create } from 'zustand';

// Helper function to sort questions: pinned first, then by relevant timestamp
const sortLiveQuestions = (questions) => {
  return [...questions].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1; // Pinned items come first
    if (!a.pinned && b.pinned) return 1;  // Pinned items come first
    if (a.pinned && b.pinned) {
      // Both are pinned, sort by pinned timestamp (earlier pinned comes first)
      return (a.pinnedTimestamp || 0) - (b.pinnedTimestamp || 0);
    }
    // Both are unpinned, sort by original timestamp (LATER added comes first for unpinned)
    return b.timestamp - a.timestamp;
  });
};

const useInterviewStore = create((set, get) => ({
  // State for live interview questions
  liveQuestions: [],
  isLoadingLiveQuestions: false, // To indicate if Firestore listener is active or initial fetch is happening
  liveQuestionsError: null,

  // Actions related to live questions
  setLiveQuestions: (questions) => set({ liveQuestions: questions, liveQuestionsError: null, isLoadingLiveQuestions: false }),
  addLiveQuestion: (questionText) => {
    // Prevent adding empty or whitespace-only questions
    if (!questionText || questionText.trim() === "") {
      console.warn("Attempted to add an empty question. It will not be added.", { questionText });
      return;
    }

    const { liveQuestions } = get();
    // Prevent duplicates based on text content of existing question objects
    if (liveQuestions.some(q => q.text === questionText)) {
      console.warn("Attempted to add a duplicate question. It will not be added.", { questionText });
      return;
    }

    const newQuestion = {
      text: questionText,
      pinned: false,
      timestamp: Date.now(),
      pinnedTimestamp: null,
    };

    set((state) => ({ 
      liveQuestions: sortLiveQuestions([...state.liveQuestions, newQuestion]) 
    }));
  },
  togglePinQuestion: (questionText) => {
    set((state) => {
      const updatedQuestions = state.liveQuestions.map(q => {
        if (q.text === questionText) {
          const isNowPinned = !q.pinned;
          return { 
            ...q, 
            pinned: isNowPinned,
            pinnedTimestamp: isNowPinned ? (q.pinnedTimestamp || Date.now()) : q.pinnedTimestamp
          };
        }
        return q;
      });
      return { liveQuestions: sortLiveQuestions(updatedQuestions) };
    });
  },
  dismissQuestion: (questionText) => {
    set((state) => ({
      liveQuestions: state.liveQuestions.filter(q => q.text !== questionText),
    }));
  },
  clearLiveSession: () => set({
    liveQuestions: [],
    isLoadingLiveQuestions: false,
    liveQuestionsError: null,
  }),

  // State for interview results (transcript and summary)
  transcript: '',
  summary: '',
  isLoadingResults: false,
  resultsError: null,

  // Actions related to results
  setResults: ({ transcript, summary }) => set({
    transcript,
    summary,
    isLoadingResults: false,
    resultsError: null,
  }),
  setResultsLoading: () => set({ isLoadingResults: true, resultsError: null }),
  setResultsError: (error) => set({ resultsError: error, isLoadingResults: false }),
  clearResults: () => set ({ transcript: '', summary: '', resultsError: null, isLoadingResults: false }),

  // TODO: Add state and actions for blacklist if needed for UI optimistic updates or display
}));

export default useInterviewStore; 