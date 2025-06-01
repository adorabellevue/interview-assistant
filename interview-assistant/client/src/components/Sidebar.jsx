import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  DocumentPlusIcon,
  MicrophoneIcon,
  ClipboardDocumentListIcon,
  // Bars3Icon // For hamburger menu later - keep for now if needed
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Generate Initial Questions', href: '/upload', icon: DocumentPlusIcon },
  { name: 'Real-time Interview Assistance', href: '/live', icon: MicrophoneIcon },
  { name: 'Results', href: '/results', icon: ClipboardDocumentListIcon },
];

const Sidebar = () => {
  // Placeholder for mobile open state
  // const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    // Sidebar container - initial styling, will be refined for responsiveness
    // Using Tailwind classes for a fixed width sidebar on larger screens and default full width on smaller.
    // lg:w-72 for large screens (fixed 72px as per plan is quite narrow, using 72 units = 18rem or 288px for better text visibility, let's assume 72 meant a common sidebar width like w-64 or w-72 in Tailwind units)
    // For now, a more standard w-64 (16rem / 256px) might be better. Plan says 72px fixed for lg: - this is very narrow.
    // Let's try w-64 (256px) for now and can adjust. The plan also mentions "collapses to hamburger below 1024px" (lg breakpoint).
    <div className="flex flex-col w-64 h-screen sticky top-0 z-10 flex-shrink-0 px-4 py-8 bg-gray-800 text-white">
      {/* Logo or App Name (Optional) */}
      <div className="mb-10 px-2">
        <h2 className="text-2xl font-semibold text-white">NextQ Hire</h2>
      </div>

      {/* Navigation */}
      <nav className="flex-grow">
        <ul className="space-y-2">
          {navigation.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 rounded-md text-sm font-medium group 
                  ${isActive
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`
                }
              >
                <item.icon className="h-6 w-6 mr-3 text-gray-400 group-hover:text-gray-300" aria-hidden="true" />
                <span className="truncate">{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Hamburger button placeholder for mobile will be handled later */}
    </div>
  );
};

export default Sidebar; 