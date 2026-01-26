import { Outlet } from "react-router-dom";
import Header from "./Header";

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="bg-gray-800 text-white text-center py-6 mt-12">
        <p className="text-base md:text-sm text-gray-400">
          Character Submission System • Powered by Patreon
        </p>
      </footer>
    </div>
  );
}
