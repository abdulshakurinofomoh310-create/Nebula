Nebula Tech — Integrated Music Studio Visualizer Demo
----------------------------------------------------

Files in this package:
- studio_index.html   -> main demo page (open in browser)
- studio_app.js       -> audio + visualizer logic
- demo.mp3            -> optional demo track (not included here; add your own or download a royalty-free track)
- README.txt          -> this file

How to run:
1. Place demo.mp3 (optional) into the same folder if you want the demo track.
2. Serve with a local HTTP server for best results:
   - python3 -m http.server
   - then open http://localhost:8000/studio_index.html in Chrome/Edge
3. Allow microphone access when prompted to record.
4. Use Record / Stop / Play / Upload controls to test.

Notes:
- Real-time advanced pitch correction is not included (requires external DSP libraries).
- For production, host over HTTPS for microphone access on remote devices.
- This demo is provided as part of Nebula Tech package for integration or resale.
