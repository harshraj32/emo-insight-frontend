import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';

const EmoInsight = () => {
  const [setupPhase, setSetupPhase] = useState('welcome');
  const [userName, setUserName] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingDescription, setMeetingDescription] = useState('');
  const [meetingObjective, setMeetingObjective] = useState('');
  const [attendees, setAttendees] = useState('');
  const [selectedEmotions, setSelectedEmotions] = useState(['Confusion', 'Boredom', 'Concentration', 'Doubt', 'Authenticity']);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmotionDetails, setShowEmotionDetails] = useState(false);
  const [status, setStatus] = useState('Welcome!');
  const [setupLogs, setSetupLogs] = useState([]);
  const [currentEmotion, setCurrentEmotion] = useState({ 
    type: '', 
    name: '', 
    color: '', 
    participant: '', 
    confidence: 0,
    isSalesRep: false 
  });
  const [emotionBreakdown, setEmotionBreakdown] = useState([]);
  const [affinaAdvice, setAffinaAdvice] = useState('');
  const [showAffinaAdvice, setShowAffinaAdvice] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [isFirstTime, setIsFirstTime] = useState(true);

  const socketRef = useRef(null);
  const BACKEND_URL = 'https://emo-insight-backend.onrender.com';

  const availableEmotions = [
    'Confusion', 'Boredom', 'Concentration', 'Doubt', 'Authenticity',
    'Joy', 'Excitement', 'Sadness', 'Anger', 'Fear', 'Surprise',
    'Disgust', 'Contempt', 'Pride', 'Shame', 'Guilt', 'Embarrassment',
    'Gratitude', 'Love', 'Interest', 'Amusement', 'Awe', 'Admiration',
    'Relief', 'Satisfaction', 'Triumph', 'Anxiety', 'Distress'
  ];

  const emotionColors = {
    'joy': 'bg-yellow-400/40 border-yellow-400/60',
    'excitement': 'bg-orange-400/40 border-orange-400/60',
    'amusement': 'bg-amber-400/40 border-amber-400/60',
    'satisfaction': 'bg-lime-400/40 border-lime-400/60',
    'concentration': 'bg-blue-500/40 border-blue-500/60',
    'interest': 'bg-blue-400/40 border-blue-400/60',
    'confusion': 'bg-amber-500/40 border-amber-500/60',
    'doubt': 'bg-gray-600/40 border-gray-600/60',
    'boredom': 'bg-gray-400/40 border-gray-400/60',
    'sadness': 'bg-blue-600/40 border-blue-600/60',
    'anger': 'bg-red-500/40 border-red-500/60',
    'fear': 'bg-purple-600/40 border-purple-600/60',
    'authenticity': 'bg-green-500/40 border-green-500/60',
    'love': 'bg-pink-400/40 border-pink-400/60',
    'surprise': 'bg-cyan-400/40 border-cyan-400/60',
    'disgust': 'bg-green-600/40 border-green-600/60',
    'contempt': 'bg-red-600/40 border-red-600/60',
    'pride': 'bg-indigo-400/40 border-indigo-400/60',
    'shame': 'bg-stone-500/40 border-stone-500/60',
    'guilt': 'bg-gray-500/40 border-gray-500/60',
    'embarrassment': 'bg-red-300/40 border-red-300/60',
    'gratitude': 'bg-rose-300/40 border-rose-300/60',
    'awe': 'bg-purple-400/40 border-purple-400/60',
    'admiration': 'bg-violet-400/40 border-violet-400/60',
    'relief': 'bg-teal-300/40 border-teal-300/60',
    'triumph': 'bg-yellow-400/40 border-yellow-400/60',
    'anxiety': 'bg-violet-600/40 border-violet-600/60',
    'distress': 'bg-red-700/40 border-red-700/60'
  };

  useEffect(() => {
    const savedUserName = localStorage.getItem('emoInsight_userName');
    if (savedUserName) {
      setUserName(savedUserName);
      setIsFirstTime(false);
      setSetupPhase('meeting-config');
    }

    connectToBackend();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (!sessionId || !socketRef.current) {
      return;
    }
    
    const attemptJoin = () => {
      if (socketRef.current.connected) {
        addSetupLog('Joining session...');
        socketRef.current.emit('join_session', { session_id: sessionId });
      } else {
        addSetupLog('Waiting for connection...');
      }
    };
    
    attemptJoin();
    
    const handleConnect = () => {
      addSetupLog('Reconnected - rejoining session...');
      attemptJoin();
    };
    
    socketRef.current.on('connect', handleConnect);
    
    return () => {
      if (socketRef.current) {
        socketRef.current.off('connect', handleConnect);
      }
    };
  }, [sessionId]);
  
  const connectToBackend = () => {
    try {
      socketRef.current = io(BACKEND_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        path: '/socket.io',
        timeout: 20000,
      });

      socketRef.current.on('connect', () => {
        setConnectionStatus('connected');
        setStatus('Analysis active');
        addSetupLog('Connected to backend');
      });

      socketRef.current.on('disconnect', () => {
        setConnectionStatus('disconnected');
        setStatus('Disconnected');
        addSetupLog('Disconnected from backend');
      });

      socketRef.current.on('connect_error', (error) => {
        setConnectionStatus('error');
        setStatus('Connection error');
        addSetupLog(`Connection error: ${error.message}`);
      });

      socketRef.current.on('log_update', (data) => {
        if (data.logs && Array.isArray(data.logs)) {
          const filteredLogs = data.logs.map(log => {
            return log
              .replace(/session_id[:\s]+[\w-]+/gi, '')
              .replace(/bot_id[:\s]+[\w-]+/gi, '')
              .replace(/Session created[:\s]+[\w-]+/gi, 'Session created')
              .replace(/\[[\w-]{36}\]/g, '');
          }).filter(log => log.trim());
          setSetupLogs(filteredLogs);
        }
      });

      socketRef.current.on('emotion_detected', (data) => {
        handleEmotionDetected(data);
      });

      socketRef.current.on('affina_advice', (data) => {
        if (data && data.advice) {
          handleAffinaAdvice(data.advice);
        } else {
          handleAffinaAdvice(
            typeof data === 'string' ? data : JSON.stringify(data)
          );
        }
      });

      socketRef.current.on('error', (data) => {
        addSetupLog(`Error: ${data.message || JSON.stringify(data)}`);
      });

    } catch (error) {
      setConnectionStatus('error');
      setStatus('Connection failed');
      addSetupLog('Backend connection failed');
    }
  };

  const addSetupLog = (message) => {
    const cleanMessage = message
      .replace(/session_id[:\s]+[\w-]+/gi, '')
      .replace(/bot_id[:\s]+[\w-]+/gi, '')
      .replace(/Session created[:\s]+[\w-]+/gi, 'Session created')
      .replace(/\[[\w-]{36}\]/g, '');
    
    if (cleanMessage.trim()) {
      setSetupLogs(prev => [...prev.slice(-9), `[${new Date().toLocaleTimeString()}] ${cleanMessage.trim()}`]);
      
      if (cleanMessage.includes('Bot joined')) {
        setStatus('Recording active');
      } else if (cleanMessage.includes('Recording started')) {
        setStatus('Recording in progress');
      }
    }
  };

  const handleEmotionDetected = (data) => {
    const { speaker, audio, video, is_sales_rep, blended_label } = data;
    
    let allEmotions = [];
    let mediaType = 'unknown';
    
    if (video && video.top_emotions && video.top_emotions.length > 0) {
      allEmotions = video.top_emotions.map(e => ({
        name: e.name,
        score: e.score,
        source: 'facial'
      }));
      mediaType = 'facial';
    }
    else if (audio && audio.top_emotions && audio.top_emotions.length > 0) {
      allEmotions = audio.top_emotions.map(e => ({
        name: e.name,
        score: e.score,
        source: 'voice'
      }));
      mediaType = 'voice';
    }
    
    if (allEmotions.length > 0) {
      const topEmotion = allEmotions[0];
      const threshold = 0.07;
      
      const closeEmotions = allEmotions.filter(e => 
        topEmotion.score - e.score <= threshold
      ).slice(0, 3);
      
      const displayLabel = blended_label || (
        closeEmotions.length > 1 
          ? closeEmotions.map(e => e.name).join(',')
          : topEmotion.name
      );
      
      setCurrentEmotion({
        type: 'audio-video',
        name: displayLabel,
        participant: speaker || 'Unknown',
        confidence: topEmotion.score,
        color: emotionColors[topEmotion.name.toLowerCase()] || 'bg-gray-400/40 border-gray-400/60',
        isSalesRep: is_sales_rep || false
      });
      
      setEmotionBreakdown(closeEmotions);
      
      const roleIndicator = is_sales_rep ? ' [You]' : ' [Customer]';
      addSetupLog(`${speaker}${roleIndicator}: ${displayLabel} (${Math.round(topEmotion.score * 100)}%)`);
    }
  };

  const handleAffinaAdvice = (advice) => {
    try {
      if (typeof advice === 'string') {
        setAffinaAdvice(advice);
      } else if (advice && typeof advice === 'object') {
        if (advice.advice) {
          setAffinaAdvice(advice.advice);
        } else if (advice.recommendation) {
          setAffinaAdvice(advice.recommendation);
        } else {
          setAffinaAdvice(JSON.stringify(advice));
        }
      } else {
        setAffinaAdvice('Processing feedback...');
      }
    } catch (error) {
      setAffinaAdvice('Coach is analyzing...');
    }
  };

  const toggleEmotion = (emotion) => {
    setSelectedEmotions(prev => 
      prev.includes(emotion) 
        ? prev.filter(e => e !== emotion)
        : [...prev, emotion]
    );
  };

  const startSession = async () => {
    try {
      setSetupPhase('recording');
      setStatus('Initializing...');
      setIsRecording(true);
      
      localStorage.setItem('emoInsight_userName', userName);
      addSetupLog('Creating session...');
      
      const response = await fetch(`${BACKEND_URL}/api/start-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_name: userName,
          meeting_url: meetingLink,
          meeting_objective: meetingObjective,
          selected_emotions: selectedEmotions
        })
      });

      const data = await response.json();

      if (data.success) {
        setSessionId(data.session_id);
        setStatus('Analysis Active...');
        addSetupLog('Session created');
        addSetupLog('Bot joining meeting');
        addSetupLog('Please admit the bot');
        
      } else {
        throw new Error(data.error || 'Failed to start session');
      }

    } catch (error) {
      setStatus(`Failed: ${error.message}`);
      addSetupLog(`ERROR: ${error.message}`);
      setIsRecording(false);
      setSetupPhase('meeting-config');
    }
  };

  const stopSession = async () => {
    try {
      if (sessionId) {
        addSetupLog('Stopping session...');
        
        const response = await fetch(`${BACKEND_URL}/api/stop-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ session_id: sessionId })
        });

        const data = await response.json();
        addSetupLog(data.message || 'Session stopped');
      }

      setIsRecording(false);
      setSetupPhase('meeting-config');
      setSessionId(null);
      setCurrentEmotion({ type: '', name: '', color: '', participant: '', confidence: 0, isSalesRep: false });
      setEmotionBreakdown([]);
      setAffinaAdvice('');
      setStatus('Session ended');
      setSetupLogs([]);
      setShowAffinaAdvice(false);

    } catch (error) {
      addSetupLog(`Stop error: ${error.message}`);
    }
  };

  const handleClose = () => {
    if (isRecording) {
      stopSession();
    }
    try {
      if (window.require) {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.send('close-app');
      }
    } catch (error) {
      window.close();
    }
  };

  const getStatusIndicator = () => {
    if (setupPhase === 'recording') {
      switch (connectionStatus) {
        case 'connected':
          return { color: 'bg-green-400', animation: 'animate-pulse', text: 'Live' };
        case 'error':
          return { color: 'bg-red-400', animation: '', text: 'Error' };
        default:
          return { color: 'bg-yellow-400', animation: 'animate-pulse', text: 'Connecting' };
      }
    } else {
      return { color: 'bg-blue-400', animation: 'animate-pulse', text: 'Ready' };
    }
  };

  const indicator = getStatusIndicator();

  return (
    <div className="w-full h-full flex items-center justify-center min-h-screen" style={{ background: 'transparent' }}>
      <div className="w-96 bg-black/85 backdrop-blur-lg rounded-2xl border border-white/30 shadow-2xl overflow-hidden">
        <div 
          className="bg-black/80 backdrop-blur-sm p-4 text-center relative cursor-move select-none border-b border-white/20"
          style={{ WebkitAppRegion: 'drag' }}
        >
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 w-5 h-5 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white text-xs transition-all duration-200 hover:scale-110 focus:outline-none"
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            ×
          </button>
          <h1 className="text-lg font-semibold text-white">AFFINA</h1>
          {userName && (
            <p className="text-white/70 text-xs mt-1">AI Emo Insight Layer</p>
          )}
        </div>

        <div className="p-5 space-y-4 max-h-[calc(100vh-120px)] overflow-y-auto">
          {setupPhase === 'welcome' && (
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-4">Welcome!</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-white/80 mb-6">What's your name?</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white/40"
                    placeholder="Enter your name"
                  />
                </div>
                
                <button
                  onClick={() => {
                    if (userName.trim()) {
                      setSetupPhase('meeting-config');
                    }
                  }}
                  disabled={!userName.trim()}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  Get Started
                </button>
              </div>
            </div>
          )}

          {setupPhase === 'meeting-config' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white mb-4">
                {isFirstTime ? `Hi ${userName}! Let's set up your meeting` : `Welcome back, ${userName}!`}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-white/90 text-sm font-medium mb-2">Zoom Link</label>
                  <input
                    type="url"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white/40"
                    placeholder="https://zoom.us/xxx-xxxx-xxx"
                  />
                </div>

                <div>
                  <label className="block text-white/90 text-sm font-medium mb-2">Meeting Objective</label>
                  <textarea
                    value={meetingObjective}
                    onChange={(e) => setMeetingObjective(e.target.value)}
                    className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white/40 h-20 resize-none"
                    placeholder="What do you want to achieve in this meeting?"
                  />
                </div>

                <div>
                  <label className="block text-white/90 text-sm font-medium mb-3">Emotions to Monitor</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedEmotions.map(emotion => (
                      <span
                        key={emotion}
                        onClick={() => toggleEmotion(emotion)}
                        className="px-3 py-1 bg-blue-500/40 border border-blue-400/60 text-white text-sm rounded-full cursor-pointer hover:bg-blue-500/60 transition-colors"
                      >
                        {emotion} ×
                      </span>
                    ))}
                  </div>
                  
                  <details className="bg-white/5 rounded-lg">
                    <summary className="p-3 text-white/80 text-sm cursor-pointer hover:text-white">
                      Add more emotions
                    </summary>
                    <div className="p-3 pt-0 flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {availableEmotions.filter(emotion => !selectedEmotions.includes(emotion)).map(emotion => (
                        <span
                          key={emotion}
                          onClick={() => toggleEmotion(emotion)}
                          className="px-2 py-1 bg-white/10 border border-white/20 text-white/70 text-sm rounded-full cursor-pointer hover:bg-white/20 hover:text-white transition-colors"
                        >
                          + {emotion}
                        </span>
                      ))}
                    </div>
                  </details>
                </div>

                <button
                  onClick={startSession}
                  disabled={!meetingLink || !meetingObjective || selectedEmotions.length === 0}
                  className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                >
                  Begin Meeting Analysis
                </button>
              </div>
            </div>
          )}

          {setupPhase === 'recording' && (
            <>
              <div className="flex items-center text-sm">
                <div className={`w-3 h-3 rounded-full mr-2 ${indicator.color} ${indicator.animation}`}></div>
                <span className="text-white font-medium">{indicator.text}</span>
                <span className="mx-2 text-white/50">•</span>
                <span className="text-white/70">{status}</span>
              </div>
              {currentEmotion.name && (
  <div className="rounded-xl border border-white/20 overflow-hidden bg-white/5">
    {/* Collapsed Header */}
    <button
      onClick={() => setShowEmotionDetails(!showEmotionDetails)}
      className="w-full p-3 text-left transition-colors hover:bg-white/10 flex items-center justify-between"
      style={{ WebkitAppRegion: 'no-drag' }}
    >
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded ${currentEmotion.color.split(' ')[0]}`}></div>
        <span className="text-white/90 font-medium text-sm">Current Emotion</span>
        {currentEmotion.isSalesRep && (
          <span className="text-xs bg-blue-500/50 px-2 py-0.5 rounded-full text-white">You</span>
        )}
      </div>
      <span className="text-white/70 text-xs">{showEmotionDetails ? '▼' : '▶'}</span>
    </button>
    
    {/* Expanded Content */}
    {showEmotionDetails && (
      <div className="p-4 bg-black/40 border-t border-white/20">
        {/* Emotion Details - Colored Box */}
        <div className={`rounded-lg p-3 border-2 ${currentEmotion.color}`}>
          <div className="text-white/70 text-xs mb-2">
            {currentEmotion.type === 'facial' ? 'Facial' : 'Facial-Audio'} • <span className="text-white/50">10s ago</span>
          </div>
          <div className="text-white text-base font-bold capitalize mb-3">
            {currentEmotion.participant}: {currentEmotion.name}
          </div>
          <div className="w-full bg-white/20 rounded-full h-2 mb-1">
            <div 
              className="bg-white/80 h-2 rounded-full transition-all duration-500" 
              style={{width: `${Math.round(currentEmotion.confidence * 100)}%`}}
            ></div>
          </div>
          <div className="text-white/70 text-xs text-right">
            {Math.round(currentEmotion.confidence * 100)}% confidence
          </div>
        </div>

        {/* Detailed Breakdown - Separate section with spacing */}
        {emotionBreakdown.length > 1 && (
          <div className="mt-3 rounded-lg bg-black/60 border border-white/20 p-3">
            <div className="text-white/90 text-xs font-medium mb-3">Detailed Breakdown</div>
            <div className="space-y-2">
              {emotionBreakdown.map((emotion, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-white/80 text-xs w-20 capitalize truncate">
                    {emotion.name}
                  </span>
                  <div className="flex-1 bg-white/20 rounded-full h-1.5">
                    <div 
                      className="bg-white/80 h-1.5 rounded-full transition-all duration-500" 
                      style={{width: `${emotion.score * 100}%`}}
                    />
                  </div>
                  <span className="text-white/70 text-xs w-10 text-right">
                    {Math.round(emotion.score * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )}
  </div>
)}

              {/* Affina Advice - Collapsible */}
              {affinaAdvice && (
                <div className="rounded-xl border border-blue-500/30 overflow-hidden">
                  <button
                    onClick={() => setShowAffinaAdvice(!showAffinaAdvice)}
                    className="w-full bg-blue-500/10 hover:bg-blue-500/20 p-3 text-left transition-colors flex items-center justify-between"
                    style={{ WebkitAppRegion: 'no-drag' }}
                  >
                    <div className="flex items-center">
                      <div className="w-5 h-5 bg-blue-500/80 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2">
                        A
                      </div>
                      <span className="text-white font-medium text-sm">Affina Says</span>
                    </div>
                    <span className="text-white/70 text-xs">{showAffinaAdvice ? '▼' : '▶'}</span>
                  </button>
                  
                  {showAffinaAdvice && (
                    <div className="p-4 bg-black/40 border-t border-blue-500/20">
                      <div className="text-white/90 text-sm leading-relaxed">
                        {affinaAdvice}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Activity Log */}
              <div className="rounded-xl border border-white/20 overflow-hidden">
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="w-full bg-white/10 hover:bg-white/15 p-3 text-left text-white font-medium text-sm transition-colors flex items-center justify-between"
                  style={{ WebkitAppRegion: 'no-drag' }}
                >
                  <span>Activity Log</span>
                  <span className="text-xs">{showLogs ? '▼' : '▶'}</span>
                </button>
                
                {showLogs && (
                  <div className="bg-black/60 p-4 max-h-40 overflow-y-auto border-t border-white/10">
                    {setupLogs.length > 0 ? (
                      setupLogs.map((log, index) => (
                        <div key={index} className="text-xs text-white/80 font-mono mb-1">
                          {log}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-white/50 font-mono">
                        Waiting for activity...
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={stopSession}
                className="w-full bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
              >
                End Meeting Analysis
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

function App() {
  return <EmoInsight />;
}

export default App;