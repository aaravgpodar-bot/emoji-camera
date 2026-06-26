# Emoji Camera App Plan

## One-Sentence Idea

A browser app that opens your camera, detects your face/expression in real time, places the matching emoji over your face, lets you take screenshots, and keeps a sidebar of recognized emojis that you can copy.

## Token Budget Target

Aim for about **17% of remaining tokens** by building a focused single-page version first.

To stay near that:

- No backend.
- No login.
- No cloud sync.
- No deployment unless requested later.
- Use a proven browser face/expression library instead of building detection from scratch.
- Keep the app in one HTML/CSS/JS project or one simple folder.

## Main Features

1. **Camera View**
   - Ask for camera permission.
   - Show live webcam feed.
   - Keep camera processing in the browser.
   - Show a friendly blocked-camera message if permission is denied.

2. **Real-Time Face Emoji Overlay**
   - Detect the main face.
   - Read expression or facial cues.
   - Place a large emoji over the detected face.
   - Move/resize the emoji as the face moves.
   - If no face is found, show a neutral waiting state.

3. **About 10 Emojis**
   Suggested emoji set:
   - Happy: 😄
   - Laughing: 😂
   - Surprised: 😮
   - Shocked/scared: 😱
   - Sad: 😢
   - Angry: 😠
   - Neutral: 😐
   - Thinking/confused: 🤔
   - Sleepy/tired: 😴
   - Cool/confident: 😎

4. **Recognized Emoji Sidebar**
   - Show every emoji the app has recognized during the session.
   - Include the emoji, label, and time seen.
   - Add a copy button for each emoji.
   - Add a clear-history button.
   - Optionally highlight the currently active emoji.

5. **Copy Emoji**
   - Clicking copy should copy only the emoji character.
   - Show a short confirmation like “Copied 😄”.

6. **Screenshot Option**
   - Button to capture the current camera frame with emoji overlay.
   - Download screenshot as PNG.
   - If possible, also add “copy image” support, but keep download as the reliable base.

7. **Expression Guide**
   - A guide panel explaining how to trigger each emoji.
   - Example:
     - 😄 Smile naturally.
     - 😂 Open-mouth smile/laugh.
     - 😮 Raise eyebrows/open mouth.
     - 😢 Frown or look sad.
     - 😠 Furrow eyebrows.
     - 😐 Relax your face.
     - 🤔 Tilt head or look thoughtful.
     - 😴 Lower eyelids/yawn-like face.
     - 😎 Confident/cool pose.
   - Include a note that detection may vary by lighting, camera quality, and face angle.

## UI Layout

Desktop:

- Main camera area on the left.
- Sidebar on the right with:
  - Current detected emoji.
  - Recognized emoji history.
  - Copy buttons.
  - Guide.

Mobile:

- Camera on top.
- Emoji history and guide underneath.
- Large easy-tap buttons.

## Visual Style

- Fun but not chaotic.
- Bright accents with a slightly dark camera-stage background.
- Big emoji overlay.
- Rounded but not overly bubbly controls.
- Clear status messages:
  - “Looking for a face...”
  - “Camera blocked.”
  - “Copied.”
  - “Screenshot saved.”

## Privacy Rules

- Camera stays in the browser.
- No video upload.
- No account needed.
- No face images saved unless the user clicks screenshot.

## Technical Approach

Use one of these:

- **face-api.js** if expression detection is simple enough to load locally/CDN.
- **MediaPipe Face Landmarker** if face tracking is more reliable and expression rules can be estimated from landmarks.

Recommended first build:

- Use a library for face detection.
- Use expression scores if available.
- Fall back to landmark/rule-based cues only if needed.

## Testing Checklist

- Camera permission prompt appears.
- Camera blocked state works.
- Face overlay follows face position.
- Each emoji can appear through detection or testing mode.
- Sidebar records recognized emojis.
- Copy button copies the emoji.
- Screenshot downloads PNG.
- Mobile layout has no horizontal overflow.
- App still works after refresh.

## Stretch Features Only If Tokens Allow

- Manual emoji override for testing.
- Confidence meter.
- Multiple faces.
- Animated emoji transitions.
- Copy screenshot to clipboard.
- Save emoji history in localStorage.
- Installable PWA.

## Not Included In First Version

- Real user accounts.
- Cloud sync.
- Backend.
- Sharing gallery.
- Recording video.
- Uploading face data.
- Perfect emotion accuracy.

