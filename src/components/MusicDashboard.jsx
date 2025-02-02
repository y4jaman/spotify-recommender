import { useState, useEffect } from 'react';
import { Play, Pause, Heart, LogOut, Music2, Radio, Clock, RefreshCw } from 'lucide-react';

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
  const [likedTracks, setLikedTracks] = useState(new Set());

  const handleLike = async (trackId) => {
    try {
      const isLiked = likedTracks.has(trackId);
      const method = isLiked ? 'DELETE' : 'PUT';
      
      const response = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${trackId}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
  
      if (response.ok) {
        const newLikedTracks = new Set(likedTracks);
        if (isLiked) {
          newLikedTracks.delete(trackId);
        } else {
          newLikedTracks.add(trackId);
        }
        setLikedTracks(newLikedTracks);
      }
    } catch (error) {
      console.error('Error toggling track like:', error);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await fetchRecentlyPlayed();
    } finally {
      setLoading(false);
    }
};

const checkSavedTracks = async (trackIds) => {
  try {
    const response = await fetch(`https://api.spotify.com/v1/me/tracks/contains?ids=${trackIds.join(',')}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const data = await response.json();
    const newLikedTracks = new Set(likedTracks);
    data.forEach((isSaved, index) => {
      if (isSaved) {
        newLikedTracks.add(trackIds[index]);
      }
    });
    setLikedTracks(newLikedTracks);
  } catch (error) {
    console.error('Error checking saved tracks:', error);
  }
};

  useEffect(() => {
    if (token) {
      console.log('Token available:', token);
      initializeData();
    }
  }, [token]);

  useEffect(() => {
    const checkLikedStatus = async () => {
      const allTracks = [...userTopTracks, ...recommendations, ...recentlyPlayed];
      const uniqueTrackIds = [...new Set(allTracks.map(track => track.id))];
      if (uniqueTrackIds.length > 0) {
        await checkSavedTracks(uniqueTrackIds);
      }
    };

    if (token) {
      checkLikedStatus();
    }
  }, [token, userTopTracks, recommendations, recentlyPlayed]);

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
        // Remove duplicates based on track ID
        const uniqueTracks = data.items.reduce((acc, current) => {
          const x = acc.find(item => item.track.id === current.track.id);
          if (!x) {
            return acc.concat([current]);
          } else {
            return acc;
          }
        }, []);
        
        console.log('Setting recently played:', uniqueTracks.length, 'unique tracks found');
        setRecentlyPlayed(uniqueTracks.map(item => item.track));
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
    try {
      // First check for available devices
      const deviceResponse = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const deviceData = await deviceResponse.json();
      console.log('Available devices:', deviceData);

      if (!deviceData.devices || deviceData.devices.length === 0) {
        alert('Please open Spotify on any device to play tracks');
        return;
      }

      // Try to play on the first available device
      const deviceId = deviceData.devices[0].id;
      const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uris: [track.uri]
        })
      });

      if (!response.ok) {
        if (response.status === 403) {
          alert('Please open Spotify Premium to control playback');
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return;
      }

      setCurrentTrack(track);
    } catch (error) {
      console.error('Error playing track:', error);
      alert('Error playing track. Make sure Spotify is open and you have an active Premium subscription.');
    }
  }

  
  
  // Add this function to handle liking/unliking
  
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
                <button 
  className={`like-button ${likedTracks.has(track.id) ? 'liked' : ''}`}
  onClick={() => handleLike(track.id)}
>
  <Heart 
    size={16} 
    fill={likedTracks.has(track.id) ? 'currentColor' : 'none'} 
  />
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