import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, ShieldCheck, QrCode } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  
  // Auth state check
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const isLoggedIn = !!token;
  
  const isHomePage = location.pathname === "/";
  const isStaffPage = location.pathname.startsWith("/staff");
  const isStaffRoute = role === "staff";

  // Helper handling
  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  const handleQRClick = () => {
    navigate("/staff/qr-scanner");
  };

  const navItems = [
    { name: "About", path: "/about", icon: ShieldCheck },
  ];

  return (
    <nav className="sticky top-0 z-50 glass-nav transition-colors duration-300">
      <div className="w-full px-4 md:px-8">
        <div className="flex items-center justify-between h-20">

          {/* LOGO */}
          <Link
            to="/"
            className="flex items-center gap-3 font-bold text-[var(--text-primary)] transition-all hover:scale-105"
          >
            <img src="/assets/kiet-university-logo.jpg" alt="KIET University" className="h-auto w-[112px] max-w-[34vw] rounded bg-white object-contain p-0.5" />
            <span className="text-xl tracking-tight text-glow">KIET Smart Queue</span>
          </Link>

          {/* DESKTOP NAV */}
          <div className="hidden lg:flex items-center gap-8">
            {isHomePage &&
              navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors hover:drop-shadow-[0_0_8px_rgba(0,212,170,0.5)]"
                  >
                    <Icon size={16} />
                    {item.name}
                  </Link>
                );
              })}

            {isLoggedIn && isStaffPage && isStaffRoute && (
              <button
                onClick={handleQRClick}
                className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
              >
                <QrCode size={18} />
                QR Code
              </button>
            )}


          </div>

          {/* RIGHT SIDE */}
          <div className="hidden lg:flex items-center gap-6">
            
            <ThemeToggle />

            <div className="h-8 w-px bg-[var(--glass-border)] mx-1"></div>

            {isLoggedIn ? (
              <>
                <span className="text-sm text-[var(--text-secondary)]">
                  Role: <b className="capitalize text-[var(--text-primary)]">{role}</b>
                </span>
                <button
                  onClick={handleLogout}
                  className="px-5 py-2.5 text-sm font-medium text-[var(--text-primary)] border border-[var(--glass-border)] bg-[var(--glass-bg)] hover:bg-[rgba(255,100,100,0.1)] hover:border-red-500/50 hover:text-red-400 rounded-xl transition-all backdrop-blur-md"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <div>
                  <Link
                    to="/login"
                    className="px-5 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors"
                  >
                    Log in
                  </Link>
                </div>

                <div>
                  <Link
                    to="/signup"
                    className="btn-nebula shadow-[0_0_20px_rgba(0,212,170,0.3)] block"
                  >
                    Sign up
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* MOBILE BUTTON */}
          <button
            onClick={() => setOpen(!open)}
            className="lg:hidden p-2 rounded-lg text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-colors border border-transparent hover:border-[var(--glass-border)]"
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* MOBILE MENU DROPDOWN */}
      {open && (
        <div className="lg:hidden absolute top-20 left-0 w-full bg-[var(--bg-primary)]/95 backdrop-blur-xl border-b border-[var(--glass-border)] p-6 flex flex-col gap-4 animate-fade-in shadow-2xl">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 p-3 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all"
              >
                <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                  <Icon size={20} />
                </div>
                <span className="font-medium text-lg">{item.name}</span>
              </Link>
            );
          })}

          <div className="flex items-center justify-between rounded-xl border border-[var(--glass-border)] p-3">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Theme</span>
            <ThemeToggle />
          </div>

          <div className="h-px bg-[var(--glass-border)] my-2" />

          {isLoggedIn ? (
            <div className="flex flex-col gap-3">
               <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
                  <span className="text-[var(--text-secondary)]">Signed in as:</span>
                  <span className="font-bold text-[var(--text-primary)] capitalize">{role}</span>
               </div>
               
               {isStaffPage && isStaffRoute && (
                  <button onClick={() => { handleQRClick(); setOpen(false); }} className="btn-secondary w-full flex items-center justify-center gap-2">
                     <QrCode size={18} /> Show QR Code
                  </button>
               )}
               


               <button 
                 onClick={handleLogout}
                 className="w-full py-3 rounded-xl bg-red-500/10 text-red-500 font-bold border border-red-500/20 hover:bg-red-500/20 transition-colors"
               >
                 Logout
               </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
               <Link to="/login" onClick={() => setOpen(false)} className="btn-secondary text-center">
                  Log in
               </Link>
               <Link to="/signup" onClick={() => setOpen(false)} className="btn-nebula text-center">
                  Sign up
               </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
