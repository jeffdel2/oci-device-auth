import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode.react';
import './App.css';

// Configuration - Replace with your Okta settings
const OKTA_CONFIG = {
  issuer: 'https://sherwindemo.twisec.com/oauth2/default',
  clientId: '0oap5hg19dNLRE2ra1d7',
  redirectUri: window.location.origin,
  scopes: ['openid', 'profile', 'email']
};

function App() {
  const [authState, setAuthState] = useState('initializing'); // initializing, qr_display, polling, authenticated, error
  const [deviceCode, setDeviceCode] = useState('');
  const [userCode, setUserCode] = useState('');
  const [verificationUri, setVerificationUri] = useState('');
  const [pollingInterval, setPollingInterval] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [error, setError] = useState('');

  // Initialize device authorization flow
  const startDeviceAuth = useCallback(async () => {
    try {
      setAuthState('initializing');
      setError('');

      // Real Okta device authorization request with retry logic
      let deviceAuthResponse;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          deviceAuthResponse = await fetch(`${OKTA_CONFIG.issuer}/v1/device/authorize`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: OKTA_CONFIG.clientId,
              scope: OKTA_CONFIG.scopes.join(' ')
            })
          });
          
          // If successful, break out of retry loop
          if (deviceAuthResponse.ok) {
            break;
          }
          
          // If rate limited, wait and retry
          if (deviceAuthResponse.status === 429) {
            retryCount++;
            if (retryCount < maxRetries) {
              console.log(`Rate limited, retrying in ${retryCount * 2} seconds...`);
              await new Promise(resolve => setTimeout(resolve, retryCount * 2000));
              continue;
            }
          }
          
          // For other errors, don't retry
          break;
        } catch (networkError) {
          retryCount++;
          if (retryCount < maxRetries) {
            console.log(`Network error, retrying in ${retryCount * 2} seconds...`);
            await new Promise(resolve => setTimeout(resolve, retryCount * 2000));
            continue;
          }
          throw networkError;
        }
      }

      if (!deviceAuthResponse.ok) {
        if (deviceAuthResponse.status === 429) {
          throw new Error('Rate limited. Please wait a moment and try again.');
        } else if (deviceAuthResponse.status === 400) {
          const errorData = await deviceAuthResponse.json();
          throw new Error(`Device authorization failed: ${errorData.error_description || errorData.error}`);
        } else {
          throw new Error(`Device authorization failed: ${deviceAuthResponse.status} ${deviceAuthResponse.statusText}`);
        }
      }

      const deviceAuthData = await deviceAuthResponse.json();
      
      // Validate required fields
      if (!deviceAuthData.device_code || !deviceAuthData.user_code || !deviceAuthData.verification_uri) {
        throw new Error('Invalid device authorization response from Okta');
      }
      
      setDeviceCode(deviceAuthData.device_code);
      setUserCode(deviceAuthData.user_code);
      setVerificationUri(deviceAuthData.verification_uri);
      setAuthState('qr_display');

      // Start polling for token
      startPolling(deviceAuthData.device_code, deviceAuthData.interval);

    } catch (err) {
      setError('Failed to initialize device authorization: ' + err.message);
      setAuthState('error');
    }
  }, []);

  // Poll for token
  const startPolling = (deviceCode, interval) => {
    setAuthState('polling');
    
    let pollCount = 0;
    const maxPolls = 60; // Maximum number of polls (5 minutes with 5-second interval)
    let currentIntervalId = null;
    
    const poll = async () => {
      try {
        pollCount++;
        console.log(`Poll attempt ${pollCount}/${maxPolls}`);
        
        // Real Okta token polling
        const tokenResponse = await fetch(`${OKTA_CONFIG.issuer}/v1/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
            client_id: OKTA_CONFIG.clientId,
            device_code: deviceCode
          })
        });

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          if (tokenData.access_token) {
            // Success! Clear the interval and fetch user profile
            console.log('Authentication successful!');
            if (currentIntervalId) {
              clearInterval(currentIntervalId);
              currentIntervalId = null;
            }
            setPollingInterval(null);
            setAuthState('authenticated');
            await fetchUserProfile(tokenData.access_token);
            return;
          }
        } else if (tokenResponse.status === 400) {
          const errorData = await tokenResponse.json();
          if (errorData.error === 'authorization_pending') {
            // Continue polling - this is expected
            console.log(`Poll ${pollCount}: Authorization pending, continuing...`);
            return;
          } else if (errorData.error === 'expired_token') {
            // Device code has expired
            console.log('Device code expired');
            if (currentIntervalId) {
              clearInterval(currentIntervalId);
              currentIntervalId = null;
            }
            setPollingInterval(null);
            setError('Device code expired. Please try again.');
            setAuthState('error');
            return;
          } else {
            // Other 400 errors
            console.log('Token error:', errorData);
            return; // Continue polling for other 400 errors
          }
        } else if (tokenResponse.status === 429) {
          // Rate limited - wait longer before next poll
          console.log('Rate limited, waiting longer before next poll...');
          return; // Continue polling but with longer interval
        } else {
          // Other HTTP errors
          console.log(`HTTP error ${tokenResponse.status}: ${tokenResponse.statusText}`);
          return; // Continue polling for other errors
        }
        
      } catch (err) {
        console.log('Polling error:', err.message);
        // Continue polling on network errors
      }
      
      // Check if we've exceeded max polls
      if (pollCount >= maxPolls) {
        console.log('Max polls reached, stopping...');
        if (currentIntervalId) {
          clearInterval(currentIntervalId);
          currentIntervalId = null;
        }
        setPollingInterval(null);
        setError('Authentication timeout. Please try again.');
        setAuthState('error');
      }
    };

    currentIntervalId = setInterval(poll, interval * 1000);
    setPollingInterval(currentIntervalId);

    // Stop polling after 5 minutes (300 seconds) as backup
    setTimeout(() => {
      if (currentIntervalId) {
        console.log('Backup timeout reached, stopping polling...');
        clearInterval(currentIntervalId);
        currentIntervalId = null;
      }
      setPollingInterval(null);
      if (authState === 'polling') {
        setError('Authentication timeout. Please try again.');
        setAuthState('error');
      }
    }, 300000);
  };

  // Real Okta user profile fetching
  const fetchUserProfile = async (accessToken) => {
    try {
      const userInfoResponse = await fetch(`${OKTA_CONFIG.issuer}/v1/userinfo`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!userInfoResponse.ok) {
        throw new Error(`User info request failed: ${userInfoResponse.status}`);
      }

      const userProfile = await userInfoResponse.json();
      setUserProfile(userProfile);
    } catch (err) {
      setError('Failed to fetch user profile: ' + err.message);
    }
  };



  // Logout
  const handleLogout = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    setAuthState('initializing');
    setDeviceCode('');
    setUserCode('');
    setVerificationUri('');
    setUserProfile(null);
    setError('');
  };

  // Scanner trigger handler
  const handleTrigger = () => {
    console.log('Scanner trigger pulled!');
    // Could add sound effects or visual feedback here
  };

  // Scanner button handlers
  const handleMenuButton = () => {
    console.log('Menu button pressed');
  };

  const handleScanButton = () => {
    console.log('Scan button pressed');
    if (authState === 'initializing') {
      startDeviceAuth();
    }
  };

  const handleEnterButton = () => {
    console.log('Enter button pressed');
    if (authState === 'error') {
      handleLogout(); // Retry
    }
  };

  const handleAuthButton = () => {
    console.log('Auth button pressed');
    if (authState === 'initializing') {
      startDeviceAuth();
    }
  };

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    };
  }, [pollingInterval]);

  const renderContent = () => {
    switch (authState) {
      case 'initializing':
        return (
          <div className="scanner-content">
            <div className="status-message">SECURE SCAN PRO</div>
            <div className="status-message">READY FOR AUTHENTICATION</div>
            <div className="status-message" style={{marginTop: '20px', fontSize: '0.9em', color: '#888'}}>
              PRESS AUTH BUTTON TO START
            </div>
          </div>
        );

      case 'qr_display':
        return (
          <div className="scanner-content">
            <div className="status-message">SCAN QR CODE WITH MOBILE DEVICE</div>
            <div className="qr-container">
              <QRCode 
                value={`${verificationUri}?user_code=${userCode}`}
                size={200}
                level="M"
                fgColor="#00ff00"
                bgColor="#000000"
              />
            </div>
            <div className="status-message">USER CODE: {userCode}</div>
            <div className="status-message">VERIFICATION URI: {verificationUri}</div>
          </div>
        );

      case 'polling':
        return (
          <div className="scanner-content">
            <div className="status-message loading">AUTHENTICATING...</div>
            <div className="qr-container">
              <QRCode 
                value={`${verificationUri}?user_code=${userCode}`}
                size={200}
                level="M"
                fgColor="#00ff00"
                bgColor="#000000"
              />
            </div>
            <div className="status-message">USER CODE: {userCode}</div>
            <div className="status-message">POLLING FOR AUTHENTICATION...</div>
          </div>
        );

      case 'authenticated':
        return (
          <div className="scanner-content">
            <div className="status-message success-message">AUTHENTICATION SUCCESSFUL</div>
            {userProfile && (
              <div className="profile-container">
                <div className="profile-field">
                  <span className="profile-label">NAME:</span>
                  <span className="profile-value">{userProfile.name}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">EMAIL:</span>
                  <span className="profile-value">{userProfile.email}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">USER ID:</span>
                  <span className="profile-value">{userProfile.sub}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">FIRST NAME:</span>
                  <span className="profile-value">{userProfile.given_name}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">LAST NAME:</span>
                  <span className="profile-value">{userProfile.family_name}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">EMAIL VERIFIED:</span>
                  <span className="profile-value">{userProfile.email_verified ? 'YES' : 'NO'}</span>
                </div>
              </div>
            )}
            <button className="logout-button" onClick={handleLogout}>
              LOGOUT
            </button>
          </div>
        );

      case 'error':
        return (
          <div className="scanner-content">
            <div className="status-message error-message">ERROR: {error}</div>
            <button className="logout-button" onClick={handleLogout}>
              RETRY
            </button>
          </div>
        );

      default:
        return (
          <div className="scanner-content">
            <div className="status-message">UNKNOWN STATE</div>
          </div>
        );
    }
  };

  return (
    <div className="scanner-screen">
      <div className="scanner-device">
        {/* Scanner handle */}
        <div className="scanner-handle">
          <div className="scanner-trigger" onClick={handleTrigger}></div>
        </div>
        
        {/* LED indicators */}
        <div className={`scanner-led red ${authState === 'error' ? 'active' : ''}`}></div>
        <div className={`scanner-led green ${authState === 'authenticated' ? 'active' : ''}`}></div>
        <div className={`scanner-led blue ${authState === 'polling' ? 'active' : ''}`}></div>
        
        {/* Scanner screen */}
        <div className="scanner-screen-area">
          <div className="scanner-screen-content">
            <div className="scanner-border">
              <div className="scanner-header">
                DEVICE AUTH
              </div>
              {renderContent()}
            </div>
          </div>
        </div>
        
        {/* Scanner buttons */}
        <div className="scanner-buttons">
          <button className="scanner-button" onClick={handleMenuButton}>MENU</button>
          <button className="scanner-button" onClick={handleScanButton}>SCAN</button>
          <button className="scanner-button auth-button" onClick={handleAuthButton}>AUTH</button>
          <button className="scanner-button" onClick={handleEnterButton}>ENTER</button>
        </div>
        
        {/* Speaker grill */}
        <div className="scanner-speaker"></div>
        
        {/* Branding */}
        <div className="scanner-branding">
          SECURE SCAN PRO<br/>
          MODEL: SS-2024
        </div>
      </div>
    </div>
  );
}

export default App; 