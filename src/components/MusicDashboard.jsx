import { useState, useEffect } from 'react';
import { Play, Pause, Heart, LogOut, Music2, Radio, Clock } from 'lucide-react';

const EmptyState = ({ type }) => (
  <div className="empty-state">
    <div className="empty-state-icon">
      {type === 'recommendations' && <Radio size={32} />}
      {type === 'top-tracks' && <Music2 size={32} />}
      {type === 'recent' && <Clock size={32} />}
    </div>
    <h3>No {type === 'recommendations' ? 'Recommendations' : type === 'top-tracks' ? 'Top Tracks' : 'Recently Played Tracks'} Yet</h3>
    <p>Listen to more music on Spotify to get personalized {type}.</p>
    <a 
      href="https://open.spotify.com/genre/pop" 
      target="_blank" 
      rel="noopener noreferrer"
      className="spotify-link"
    >
      Open Spotify to start listening
    </a>
  </div>
);

const MusicDashboard = ({ token, onLogout }) => {
  const [userTopTracks, setUserTopTracks] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [userData, setUserData] = useState(null);
  const [selectedTab, setSelectedTab] = useState('recommendations');

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await fetchRecentlyPlayed();
    } finally {
      setLoading(false);
    }
};

  useEffect(() => {
    if (token) {
      console.log('Token available:', token);
      initializeData();
    }
  }, [token]);

  const initializeData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchUserProfile(),
        fetchUserTopTracks(),
        fetchRecentlyPlayed()
      ]);
    } catch (error) {
      console.error('Error initializing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    try {
      console.log('Fetching user profile...');
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('User profile received:', data);
      setUserData(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchUserTopTracks = async () => {
    try {
      console.log('Fetching top tracks...');
      const response = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=20&time_range=long_term', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Top tracks raw data:', data);
      
      if (data.items && data.items.length > 0) {
        console.log('Setting top tracks:', data.items.length, 'tracks found');
        setUserTopTracks(data.items);
        
        // Get just 5 track IDs for seeds
        const seedTracks = data.items.slice(0, 5).map(track => track.id);
        console.log('Seed tracks:', seedTracks);
        
        // Only fetch recommendations if we have seed tracks
        if (seedTracks.length > 0) {
          // Use seed_tracks parameter correctly
          const recommendationsUrl = new URL('https://api.spotify.com/v1/recommendations');
          recommendationsUrl.searchParams.append('limit', '20');
          // Join the track IDs with commas
          recommendationsUrl.searchParams.append('seed_tracks', seedTracks.join(','));
          
          const recommendationsResponse = await fetch(recommendationsUrl.toString(), {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          if (recommendationsResponse.ok) {
            const recommendationsData = await recommendationsResponse.json();
            console.log('Recommendations data:', recommendationsData);
            if (recommendationsData.tracks) {
              setRecommendations(recommendationsData.tracks);
            }
          }
        }
      } else {
        console.log('No top tracks found');
      }
    } catch (error) {
      console.error('Error in fetchUserTopTracks:', error);
    }
  };

  const fetchRecentlyPlayed = async () => {
    try {
      console.log('Fetching recently played...');
      const response = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=20', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Recently played raw data:', data);
      
      if (data.items && data.items.length > 0) {
        console.log('Setting recently played:', data.items.length, 'tracks found');
        setRecentlyPlayed(data.items.map(item => item.track));
      } else {
        console.log('No recently played tracks found');
      }
    } catch (error) {
      console.error('Error in fetchRecentlyPlayed:', error);
    }
  };

  const handlePlayPause = async (track) => {
    if (currentTrack?.id === track.id) {
      setCurrentTrack(null);
    } else {
      setCurrentTrack(track);
      try {
        await fetch(`https://api.spotify.com/v1/me/player/play`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uris: [track.uri]
          })
        });
      } catch (error) {
        console.error('Error playing track:', error);
      }
    }
  };

  // Loading state with timeout
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.log('Loading timeout reached, forcing loading to false');
        setLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeoutId);
  }, [loading]);

  console.log('Current state:', {
    loading,
    hasUserData: !!userData,
    topTracksCount: userTopTracks.length,
    recommendationsCount: recommendations.length,
    recentlyPlayedCount: recentlyPlayed.length
  });

  if (loading && (!userData || !userTopTracks.length)) {
    return (
      <div className="dashboard-loader">
        <div className="loading-spinner"></div>
        <p>Analyzing your music taste...</p>
      </div>
    );
  }

  const getTracksForCurrentTab = () => {
    switch (selectedTab) {
      case 'recommendations':
        return recommendations;
      case 'top-tracks':
        return userTopTracks;
      case 'recent':
        return recentlyPlayed;
      default:
        return [];
    }
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <div className="dashboard-sidebar">
        <div className="sidebar-profile">
          <img 
            src={userData?.images[0]?.url || 'https://via.placeholder.com/40'} 
            alt="Profile"
          />
          <div className="profile-info">
            <h3>{userData?.display_name || 'User'}</h3>
            <p>{userData?.email || 'Spotify User'}</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${selectedTab === 'recommendations' ? 'active' : ''}`}
            onClick={() => setSelectedTab('recommendations')}
          >
            <Radio size={20} />
            Recommendations
          </button>
          <button 
            className={`nav-item ${selectedTab === 'top-tracks' ? 'active' : ''}`}
            onClick={() => setSelectedTab('top-tracks')}
          >
            <Music2 size={20} />
            Top Tracks
          </button>
          <button 
            className={`nav-item ${selectedTab === 'recent' ? 'active' : ''}`}
            onClick={() => setSelectedTab('recent')}
          >
            <Clock size={20} />
            Recently Played
          </button>
        </nav>

        <button 
          onClick={onLogout}
          className="logout-button"
        >
          <LogOut size={18} />
          Disconnect
        </button>
      </div>

      {/* Main Content */}
      <div className="dashboard-content">
        <div className="content-header">
          <div className="header-with-refresh">
            <h1>
              {selectedTab === 'recommendations' && 'Recommended for You'}
              {selectedTab === 'top-tracks' && 'Your Top Tracks'}
              {selectedTab === 'recent' && 'Recently Played'}
            </h1>
            {selectedTab === 'recent' && (
              <button 
                onClick={handleRefresh}
                className="refresh-button"
                disabled={loading}
              >
                <RefreshCw size={20} className={loading ? 'spinning' : ''} />
                Refresh
              </button>
            )}
          </div>
        </div>

        <div className="tracks-grid">
          {getTracksForCurrentTab().length > 0 ? (
            getTracksForCurrentTab().map(track => (
              <div key={track.id} className="track-card">
                <div className="track-artwork">
                  <img 
                    src={track.album.images[0]?.url} 
                    alt={track.name}
                  />
                  <div className="track-overlay">
                    <button 
                      className="play-button"
                      onClick={() => handlePlayPause(track)}
                    >
                      {currentTrack?.id === track.id ? <Pause size={24} /> : <Play size={24} />}
                    </button>
                  </div>
                </div>
                <div className="track-info">
                  <h3>{track.name}</h3>
                  <p>{track.artists[0].name}</p>
                </div>
                <button className="like-button">
                  <Heart size={16} />
                </button>
              </div>
            ))
          ) : (
            <EmptyState type={selectedTab} />
          )}
        </div>
      </div>
    </div>
  );
};

export default MusicDashboard;