import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';

function MainDashboard() {
  const location = useLocation();
  const hideTopbar = location.pathname === '/dashboard/growth' || location.pathname === '/dashboard/chatbot';
  const hideBlur = location.pathname === '/dashboard/growth' || location.pathname === '/dashboard/chatbot';

  return (
    <div className="min-h-screen flex bg-[#0d1d1e] overflow-hidden relative">
      {/* Blurred Background Circles - Hidden on Growth and Chatbot */}
      {!hideBlur && (
        <>
          <div
            className="absolute left-80 -top-48 w-full h-64 rounded-full blur-[190px] opacity-50 z-0"
            style={{ background: 'linear-gradient(to right, rgb(18, 235, 142), rgb(18, 235, 142))' }}
          ></div>
          <div
            className="absolute left-80 -bottom-24 w-full h-24 rounded-full blur-[190px] opacity-50 z-0"
            style={{ background: 'linear-gradient(to left, rgb(18, 235, 142), rgb(18, 235, 142))' }}
          ></div>
        </>
      )}

      {/* Sidebar */}
      <Sidebar />
      {/* Main Content */}
      <div className="flex-1 flex flex-col max-h-screen">
        {!hideTopbar && <Topbar />}
        <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default MainDashboard;
