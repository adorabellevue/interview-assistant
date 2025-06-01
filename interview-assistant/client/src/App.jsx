import {BrowserRouter, Routes, Route, Navigate} from 'react-router-dom';
import AppLayout from './layout/AppLayout';
import UploadPage from './pages/UploadPage';
import LivePage from './pages/LivePage';
import ResultsPage from './pages/ResultsPage';

export default function App(){
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/upload"  element={<UploadPage/>}/>
          <Route path="/live"    element={<LivePage/>}/>
          <Route path="/results" element={<ResultsPage/>}/>
          <Route path="*"        element={<Navigate to="/upload"/>}/>
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}