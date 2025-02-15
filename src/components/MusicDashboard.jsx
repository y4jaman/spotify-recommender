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
  const [isActive, setIsActive] = useState(false);

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
  // Limit the number of tracks to check in a single request
  const MAX_TRACKS_PER_REQUEST = 50;
  
  try {
    // Split track IDs into chunks of 50
    const trackIdChunks = [];
    for (let i = 0; i < trackIds.length; i += MAX_TRACKS_PER_REQUEST) {
      trackIdChunks.push(trackIds.slice(i, i + MAX_TRACKS_PER_REQUEST));
    }
    
    const newLikedTracks = new Set(likedTracks);
    
    // Process each chunk of track IDs
    for (const chunk of trackIdChunks) {
      try {
        const response = await fetch(`https://api.spotify.com/v1/me/tracks/contains?ids=${chunk.join(',')}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          console.error(`Failed to check saved tracks. Status: ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        
        // Ensure data is an array before processing
        if (Array.isArray(data)) {
          data.forEach((isSaved, index) => {
            if (isSaved) {
              newLikedTracks.add(chunk[index]);
            }
          });
        } else {
          console.error('Unexpected response format for saved tracks', data);
        }
      } catch (chunkError) {
        console.error('Error checking track chunk:', chunkError);
      }
    }
    
    // Update liked tracks state
    setLikedTracks(newLikedTracks);
    
  } catch (error) {
    console.error('Error checking saved tracks:', error);
  }
};

// Update the fetchCurrentPlayback function
const fetchCurrentPlayback = async () => {
  try {
    const response = await fetch('https://api.spotify.com/v1/me/player', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    // If response is 204 (no content) or empty, it means nothing is playing
    if (response.status === 204 || !response.ok) {
      setCurrentTrack(null);
      setIsActive(false);
      return;
    }

    const data = await response.json();
    // Update current track and active state based on what's playing in Spotify
    if (data && data.item) {
      // Find the track in our lists that matches the currently playing track
      const playingTrackId = data.item.id;
      const allTracks = [
        ...userTopTracks, 
        ...recommendations, 
        ...recentlyPlayed
      ];
      const matchingTrack = allTracks.find(track => track.id === playingTrackId);
      
      if (matchingTrack) {
        setCurrentTrack(matchingTrack);
      } else {
        // If the track isn't in our lists, still update the current track
        setCurrentTrack(data.item);
      }
      setIsActive(data.is_playing);
    } else {
      setCurrentTrack(null);
      setIsActive(false);
    }
  } catch (error) {
    if (error.message !== "Unexpected end of JSON input") {
      console.error('Error fetching playback state:', error);
    }
    setCurrentTrack(null);
    setIsActive(false);
  }
};
// Update the polling interval to be less frequent to avoid rate limiting
useEffect(() => {
  if (!token) return;

  // Initial fetch
  fetchCurrentPlayback();

  // Poll every 3 seconds instead of 1
  const interval = setInterval(fetchCurrentPlayback, 3000);

  return () => clearInterval(interval);
}, [token]);

  useEffect(() => {
    if (token) {
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
      const response = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=long_term', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.items?.length) {
        console.log('No top tracks found');
        return;
      }
  
      // Set user top tracks first
      setUserTopTracks(data.items);
      
      // Prepare for recommendations
      const recentlyPlayedIds = recentlyPlayed.map(track => track.id);
      const savedTrackIds = Array.from(likedTracks);
      
      // Call recommendations with necessary context
      await fetchNewRecommendations(data.items, recentlyPlayedIds, savedTrackIds);
  
    } catch (error) {
      console.error('Error in fetchUserTopTracks:', error);
    }
  };
  
  // Update the fetchNewRecommendations function
  const fetchNewRecommendations = async (topTracks, recentlyPlayedIds, savedTrackIds) => {
    try {
      // Get artist information for top tracks
      const artistIds = [...new Set(topTracks.map(track => track.artists[0].id))].slice(0, 5);
      
      // Fetch top tracks for these artists
      const artistTrackPromises = artistIds.map(async (artistId) => {
        try {
          const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (!response.ok) {
            console.warn(`Failed to fetch top tracks for artist ${artistId}`);
            return { tracks: [] };
          }
          
          return response.json();
        } catch (error) {
          console.warn(`Error fetching tracks for artist ${artistId}:`, error);
          return { tracks: [] };
        }
      });
      
      const artistTopTracks = await Promise.all(artistTrackPromises);
      
      // Comprehensive set of track IDs to exclude
      const excludedTrackIds = new Set([
        ...topTracks.map(track => track.id),
        ...recentlyPlayedIds,
        ...savedTrackIds
      ]);
      
      // Check saved status for all tracks
      const trackIdsToCheck = artistTopTracks
        .flatMap(artistTrack => artistTrack.tracks)
        .map(track => track.id)
        .filter(id => !excludedTrackIds.has(id));
      
      // Batch check saved tracks
      const MAX_TRACKS_PER_REQUEST = 50;
      const savedStatusChunks = [];
      for (let i = 0; i < trackIdsToCheck.length; i += MAX_TRACKS_PER_REQUEST) {
        const chunk = trackIdsToCheck.slice(i, i + MAX_TRACKS_PER_REQUEST);
        const response = await fetch(`https://api.spotify.com/v1/me/tracks/contains?ids=${chunk.join(',')}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!response.ok) {
          console.warn('Failed to check saved tracks');
          continue;
        }
        
        const savedStatus = await response.json();
        savedStatusChunks.push(...savedStatus.map((isSaved, index) => ({
          trackId: chunk[index],
          isSaved
        })));
      }
      
      // Add newly found saved tracks to exclusion set
      savedStatusChunks
        .filter(item => item.isSaved)
        .forEach(item => excludedTrackIds.add(item.trackId));
      
      // Final filtering of tracks
      const seenTrackIds = new Set();
      const potentialTracks = artistTopTracks
        .flatMap(artistTrack => artistTrack.tracks)
        .filter(track => {
          if (!track || !track.id) return false;
          
          // Exclude if:
          // 1. Already seen in this recommendation batch
          // 2. In the excluded tracks set
          if (seenTrackIds.has(track.id) || 
              excludedTrackIds.has(track.id)) {
            return false;
          }
          
          seenTrackIds.add(track.id);
          return true;
        })
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, 50);
      
      // Update recommendations state
      setRecommendations(potentialTracks);
      
      return potentialTracks;
      
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return [];
    }
  };

  const fetchRecentlyPlayed = async () => {
    try {
      console.log('Fetching recently played...');
      const response = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
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
        
        setRecentlyPlayed(uniqueTracks.map(item => item.track));
      } else {
        console.log('No recently played tracks found');
      }
    } catch (error) {
      console.error('Error in fetchRecentlyPlayed:', error);
    }
};

const handlePlayPause = async (track) => {
  try {
    const deviceResponse = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (!deviceResponse.ok) {
      throw new Error('Failed to get devices');
    }
 
    const deviceData = await deviceResponse.json();
    
    // Find Spotify app or web player
    const preferredDevice = deviceData.devices.find(
      device => device.is_active || device.type === 'Computer' || device.type === 'Smartphone'
    );
 
    if (!preferredDevice) {
      window.open(track.external_urls.spotify, '_blank');
      return;
    }
 
    // Transfer playback to preferred device if not active
    if (!preferredDevice.is_active) {
      await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_ids: [preferredDevice.id],
          play: false
        })
      });
    }
 
    if (currentTrack?.id === track.id && isActive) {
      const response = await fetch(`https://api.spotify.com/v1/me/player/pause`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });
 
      if (!response.ok) throw new Error('Failed to pause');
      setIsActive(false);
      
    } else {
      const response = await fetch(`https://api.spotify.com/v1/me/player/play`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uris: [track.uri]
        })
      });
 
      if (!response.ok) throw new Error('Failed to play');
      setCurrentTrack(track);
      setIsActive(true);
    }
  } catch (error) {
    console.error('Playback error:', error);
    window.open(track.external_urls.spotify, '_blank');
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
  {currentTrack?.id === track.id && isActive ? <Pause size={24} /> : <Play size={24} />}
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