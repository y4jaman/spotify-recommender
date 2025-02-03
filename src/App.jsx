import { useState, useEffect } from 'react'
import { Music } from 'lucide-react'
import MusicDashboard from './components/MusicDashboard'

function App() {
  const [token, setToken] = useState(null)

  useEffect(() => {
    const verifyToken = async (token) => {
      try {
        const response = await fetch('https://api.spotify.com/v1/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) {
          localStorage.removeItem('token');
          setToken(null);
        }
      } catch (error) {
        localStorage.removeItem('token');
        setToken(null);
      }
    };
 
    // Check for existing token
    const existingToken = localStorage.getItem('token');
    if (existingToken) {
      verifyToken(existingToken);
      setToken(existingToken);
    }
 
    // Check URL hash for new token
    const hash = window.location.hash;
    if (!existingToken && hash) {
      const newToken = hash.substring(1).split("&").find(elem => elem.startsWith("access_token")).split("=")[1];
      localStorage.setItem('token', newToken);
      setToken(newToken);
      window.location.hash = "";
    }
  }, []);

  const logout = () => {
    window.localStorage.removeItem("token")
    setToken(null)
  }

  const login = () => {
    const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
    const REDIRECT_URI = "https://spotify-recommender-ten.vercel.app/";
    const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
    const RESPONSE_TYPE = "token";
    const SCOPE = [
        "user-read-private",
    "user-read-email",
    "user-top-read",
    "user-library-read",
    "user-read-recently-played",
    "user-modify-playback-state",
    "user-read-playback-state",
    "streaming",
    "user-read-playback-position",
    "user-library-modify",
    "user-library-read"
    ].join(" ");

    window.location.href = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=${RESPONSE_TYPE}&scope=${encodeURIComponent(SCOPE)}`;
};

  if (!token) {
    return (
      <div className="container">
        <div className="glass-card">
          <Music className="icon" />
          <h1 className="title">Spotify Recommender</h1>
          <button 
            onClick={login}
            className="button"
          >
            Connect with Spotify
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="main-container">
      <MusicDashboard token={token} onLogout={logout} />
    </div>
  )
}

export default App