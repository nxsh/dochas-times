import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-gray-200 mt-12 py-6 text-center text-sm text-warm-gray">
        Dochas Times — good news, locally.
      </footer>
    </div>
  );
}
