import { Outlet } from "react-router-dom";
import Header from "./Header";
import { siteContent } from "../../content/siteContent";

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="bg-gray-800 text-white py-8 mt-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-xl font-semibold text-white mb-2">
            {siteContent.about.contact.heading}
          </h2>
          <p className="text-base md:text-sm text-gray-300 leading-relaxed max-w-2xl mx-auto">
            {siteContent.about.contact.text}
          </p>
        </div>
      </footer>
    </div>
  );
}
