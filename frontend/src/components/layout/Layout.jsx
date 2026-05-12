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
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 text-center md:text-left">
            <div className="md:max-w-xl">
              <h2 className="text-xl font-semibold text-white mb-2">
                {siteContent.about.contact.heading}
              </h2>
              <p className="text-base md:text-sm text-gray-300 leading-relaxed">
                {siteContent.about.contact.text}
              </p>
            </div>
            <div className="flex flex-col items-center md:items-end gap-3 shrink-0">
              <p className="text-sm text-gray-400">{siteContent.donate.tagline}</p>
              <div className="flex gap-3 flex-wrap justify-center md:justify-end">
                <a
                  href={siteContent.donate.kofi.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm bg-green-900/40 border border-green-700 text-green-400 hover:bg-green-900/60 hover:border-green-500 hover:text-green-300 transition-colors"
                >
                  {siteContent.donate.kofi.label}
                </a>
                <a
                  href={siteContent.donate.paypal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm bg-blue-900/40 border border-blue-700 text-blue-400 hover:bg-blue-900/60 hover:border-blue-500 hover:text-blue-300 transition-colors"
                >
                  {siteContent.donate.paypal.label}
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
