import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6 font-sans">
      <div className="flex flex-col items-center text-center">
        <img src="/art/state-404.png" alt="" aria-hidden width={240} height={240} draggable={false} className="object-contain" />
        <h1 className="mt-7 text-[21px] font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 mb-6 max-w-sm text-[14px] text-slate-500">This link doesn't lead anywhere. It may have moved or been typed wrong.</p>
        <a href="/" className="rounded-xl bg-indigo-600 px-6 py-3 text-[14px] font-medium text-white hover:bg-indigo-700">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
