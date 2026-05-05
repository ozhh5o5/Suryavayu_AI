import { Link, Outlet, useLocation } from "react-router-dom";

const nav = [
  { path: "/", label: "Dashboard" },
  { path: "/plants", label: "Plants" },
  { path: "/alerts", label: "Alerts" },
  { path: "/models", label: "Models" },
];

export default function Layout() {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-orange-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-orange-700">SuryaVayu AI</h1>
            <p className="text-sm text-orange-900">
              KREDL/KSPDCL renewable generation forecasting control room
            </p>
          </div>
          <nav className="flex gap-2">
            {nav.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                  location.pathname === item.path
                    ? "border-orange-300 bg-orange-100 text-orange-800"
                    : "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
