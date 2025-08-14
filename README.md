# Device Authentication Emulator

A React application that emulates a low input device (like a hand scanner) with Okta device authorization grant flow. The application presents a QR code that can be scanned by a mobile device and polls for authentication completion.

## Features

- **Device Scanner Emulator UI**: Retro terminal-style interface that mimics a hand scanner
- **QR Code Display**: Generates QR codes for mobile device authentication
- **Device Authorization Flow**: Implements Okta's device authorization grant flow
- **Polling Mechanism**: Continuously polls for authentication completion
- **User Profile Display**: Shows basic user information after successful authentication
- **Responsive Design**: Works on various screen sizes

## Prerequisites

- Node.js (version 14 or higher)
- npm or yarn
- Okta Developer Account (for production use)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd device_auth
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The application will open at `http://localhost:3000`

## Configuration

### For Production Use

To use with a real Okta instance, update the configuration in `src/App.js`:

```javascript
const OKTA_CONFIG = {
  issuer: 'https://your-okta-domain.okta.com/oauth2/default',
  clientId: 'your-client-id',
  redirectUri: window.location.origin,
  scopes: ['openid', 'profile', 'email']
};
```

### Okta Setup

1. Create an Okta Developer account at [developer.okta.com](https://developer.okta.com)
2. Create a new application in your Okta admin console
3. Configure the application for device authorization flow
4. Note down your:
   - Okta domain
   - Client ID
   - Client Secret (if required)

## How It Works

### Current Implementation (Demo Mode)

The current implementation uses mock data to simulate the device authorization flow:

1. **Initialization**: App starts and generates mock device authorization data
2. **QR Code Display**: Shows a QR code with the verification URI and user code
3. **Polling**: Simulates polling for authentication completion (30% success rate after 10-30 seconds)
4. **Authentication**: Displays mock user profile upon "successful" authentication

### Real Implementation

To implement with real Okta APIs, replace the mock functions with actual API calls:

1. **Device Authorization Request**: Call Okta's `/oauth2/v1/device/authorize` endpoint
2. **Token Polling**: Call Okta's `/oauth2/v1/token` endpoint with device_code
3. **User Profile**: Call Okta's `/oauth2/v1/userinfo` endpoint with access token

## API Endpoints (for Real Implementation)

### Device Authorization
```
POST https://your-okta-domain.okta.com/oauth2/v1/device/authorize
Content-Type: application/x-www-form-urlencoded

client_id=your-client-id&scope=openid profile email
```

### Token Polling
```
POST https://your-okta-domain.okta.com/oauth2/v1/token
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:device_code&
client_id=your-client-id&
device_code=your-device-code
```

### User Info
```
GET https://your-okta-domain.okta.com/oauth2/v1/userinfo
Authorization: Bearer your-access-token
```

## UI States

The application has several UI states:

1. **Initializing**: Shows loading message while setting up device authorization
2. **QR Display**: Shows QR code and user code for mobile scanning
3. **Polling**: Shows QR code with "AUTHENTICATING..." message
4. **Authenticated**: Displays user profile information
5. **Error**: Shows error message with retry option

## Styling

The application uses a retro terminal theme with:
- Green text on black background
- Monospace font (Courier New)
- Glowing effects and animations
- Scan line animation
- Responsive design

## Available Scripts

- `npm start`: Runs the app in development mode
- `npm build`: Builds the app for production
- `npm test`: Launches the test runner
- `npm eject`: Ejects from Create React App (one-way operation)

## Dependencies

- **React**: UI framework
- **qrcode.react**: QR code generation
- **@okta/okta-auth-js**: Okta authentication (for real implementation)
- **axios**: HTTP client (for real implementation)

## Browser Support

The application works in all modern browsers that support:
- ES6+ JavaScript
- CSS Grid and Flexbox
- CSS Animations

## Security Considerations

For production use:
- Store sensitive configuration in environment variables
- Implement proper error handling
- Add rate limiting for polling requests
- Use HTTPS in production
- Implement proper session management

## Troubleshooting

### Common Issues

1. **QR Code Not Displaying**: Ensure `qrcode.react` is properly installed
2. **Polling Not Working**: Check browser console for errors
3. **Styling Issues**: Ensure CSS is properly loaded

### Development Tips

- Use browser developer tools to monitor network requests
- Check console for error messages
- Test on different screen sizes for responsive design

## License

This project is licensed under the MIT License. 