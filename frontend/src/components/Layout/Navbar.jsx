import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import './Navbar.css';

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar" id="main-navbar">
      <div className="navbar-inner container">
        <Link to="/" className="navbar-brand" id="navbar-brand">
          <div className="navbar-logo">
            <img src="/icon.png" alt="InterviewAI Logo" width="28" height="28" style={{ borderRadius: '6px' }} />
          </div>
          <span className="navbar-title">InterviewAI</span>
        </Link>

        <div className="navbar-links">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="nav-link" id="nav-dashboard">
                Dashboard
              </Link>
              <Link to="/session/setup" className="nav-link" id="nav-new-session">
                New Interview
              </Link>
              <div className="nav-user-section">
                <span className="nav-user-name">{user?.name || user?.email}</span>
                <button onClick={handleLogout} className="btn btn-ghost btn-sm" id="btn-logout">
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link" id="nav-login">
                Login
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm" id="nav-register">
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
