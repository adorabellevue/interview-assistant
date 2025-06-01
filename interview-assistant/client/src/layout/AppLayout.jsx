import React from 'react';
import Sidebar from '../components/Sidebar';

const AppLayout = ({ children }) => {
  return (
    <div className="flex bg-gray-100 h-screen">
      <Sidebar />
      <main className="flex-1 h-screen overflow-y-auto overflow-x-auto bg-gray-100 p-6">
        {children}
      </main>
    </div>
  );
};

export default AppLayout; 