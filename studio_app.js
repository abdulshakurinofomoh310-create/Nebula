\
    // studio_app.js (integrated package)
    // This is the same demo code provided earlier; it powers recording, filters, and visualizer.
    const canvas = document.getElementById('galaxyCanvas');
    const ctx = canvas.getContext('2d');
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    window.addEventListener('resize', ()=>{ W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; });

    let stars = [];
    let palette = ['hsl(260,80%,60%)','hsl(200,80%,60%)','hsl(310,80%,60%)','hsl(180,80%,60%)'];
    function randPalette(){
      const base = Math.floor(Math.random()*360);
      palette = [
        `hsl(${base},80%,60%)`,
        `hsl(${(base+40)%360},75%,55%)`,
        `hsl(${(base+200)%360},75%,45%)`
      ];
    }
    function createStars(count=260){
      stars = [];
      for(let i=0;i<count;i++){
        stars.push({
          x:Math.random()*W,
          y:Math.random()*H,
          size:Math.random()*2+0.6,
          baseSpeed: Math.random()*0.6+0.2,
          color: palette[Math.floor(Math.random()*palette.length)],
          tw: Math.random()
        });
      }
    }
    createStars();

    let analyser = null;
    let dataArray = null;

    function draw(){
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0,0,W,H);

      let bass=0,mids=0,highs=0;
      if(analyser && dataArray){
        analyser.getByteFrequencyData(dataArray);
        const n = dataArray.length;
        const bEnd = Math.floor(n*0.12);
        const mEnd = Math.floor(n*0.55);
        for(let i=0;i<n;i++){
          const v = dataArray[i];
          if(i<bEnd) bass += v;
          else if(i<mEnd) mids += v;
          else highs += v;
        }
        bass = (bass/Math.max(1,bEnd))/255;
        mids = (mids/Math.max(1,mEnd-bEnd))/255;
        highs = (highs/Math.max(1,n-mEnd))/255;
      }

      for(let s of stars){
        let speed = s.baseSpeed + bass*(1.5 + s.tw*1.2);
        s.y += speed*4;
        if(s.y > H+10){ s.y = -10; s.x = Math.random()*W; s.color = palette[Math.floor(Math.random()*palette.length)];}
        const size = s.size*(1 + mids*1.0 + Math.sin(perf()*0.005 + s.tw*10)*0.05);
        const alpha = 0.35 + highs*0.6 + Math.sin(perf()*0.01 + s.tw*4)*0.12;
        const grd = ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,size*6);
        grd.addColorStop(0, hexToRgba(s.color, alpha));
        grd.addColorStop(0.25, hexToRgba(s.color, alpha*0.6));
        grd.addColorStop(0.6, hexToRgba(s.color, alpha*0.12));
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(s.x-size*6, s.y-size*6, size*12, size*12);
        ctx.beginPath();
        ctx.fillStyle = hexToRgba('#ffffff', 0.5*(0.3+highs));
        ctx.arc(s.x, s.y, Math.max(0.4, size*0.35), 0, Math.PI*2);
        ctx.fill();
      }

      requestAnimationFrame(draw);
    }
    function perf(){ return performance.now(); }
    function hexToRgba(h,a=1){
      if(h.startsWith('hsl')) {
        return h.replace('hsl','hsla').replace(')', `,${a})`);
      }
      const c = h.replace('#','');
      const i = parseInt(c,16);
      const r=(i>>16)&255, g=(i>>8)&255, b=i&255;
      return `rgba(${r},${g},${b},${a})`;
    }
    draw();

    let audioCtx = null;
    let masterGain, lowFilter, highFilter, delayNode, feedbackGain, distNode, convolver;
    let mediaStreamSource=null, bufferSource=null;
    let recordedBuffer=null;
    let recChunks = [], mediaRecorder=null;

    function ensureAudio(){
      if(!audioCtx){
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        lowFilter = audioCtx.createBiquadFilter(); lowFilter.type='lowpass'; lowFilter.frequency.value = 12000;
        highFilter = audioCtx.createBiquadFilter(); highFilter.type='highpass'; highFilter.frequency.value = 10;
        delayNode = audioCtx.createDelay(1.0);
        feedbackGain = audioCtx.createGain(); feedbackGain.gain.value = 0;
        distNode = audioCtx.createWaveShaper();
        convolver = audioCtx.createConvolver();
        masterGain.connect(audioCtx.destination);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        masterGain.connect(analyser);
      }
    }

    function makeReverb(duration = 2, decay = 2){
      if(!audioCtx) return null;
      const rate = audioCtx.sampleRate;
      const size = rate * duration;
      const buffer = audioCtx.createBuffer(2, size, rate);
      for(let ch=0; ch<2; ch++){
        const data = buffer.getChannelData(ch);
        for(let i=0;i<size;i++){
          data[i] = (Math.random()*2-1) * Math.pow(1 - i/size, decay);
        }
      }
      return buffer;
    }

    function makeDistortion(amount){
      const k = typeof amount === 'number' ? amount * 100 : 0;
      const n = 44100;
      const curve = new Float32Array(n);
      const deg = Math.PI/180;
      for (let i = 0; i < n; ++i) {
        const x = (i*2)/n - 1;
        curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
      }
      return curve;
    }

    function connectNodes(){
      try{ highFilter.disconnect(); lowFilter.disconnect(); distNode.disconnect(); delayNode.disconnect(); feedbackGain.disconnect(); convolver.disconnect(); }catch(e){}
      highFilter.connect(lowFilter);
      lowFilter.connect(distNode);
      distNode.connect(delayNode);
      delayNode.connect(feedbackGain);
      feedbackGain.connect(delayNode);
      delayNode.connect(convolver);
      convolver.connect(masterGain);
      lowFilter.connect(masterGain);
    }

    const recBtn = document.getElementById('recordBtn');
    const stopRecBtn = document.getElementById('stopRecBtn');
    const playRecBtn = document.getElementById('playRecBtn');
    const fileInput = document.getElementById('file');
    const status = document.getElementById('status');
    const regenBtn = document.getElementById('regenBtn');
    const demoBtn = document.getElementById('uploadDemo');

    const gainEl = document.getElementById('gain');
    const lowEl = document.getElementById('low');
    const highEl = document.getElementById('high');
    const delayEl = document.getElementById('delay');
    const distEl = document.getElementById('dist');
    const pitchEl = document.getElementById('pitch');

    recBtn.onclick = async ()=>{
      status.innerText = 'Recording...';
      ensureAudio();
      try{
        const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
        mediaStreamSource = audioCtx.createMediaStreamSource(stream);
        mediaStreamSource.connect(highFilter);
        connectNodes();
        if(window.MediaRecorder){
          const mr = new MediaRecorder(stream);
          recChunks = [];
          mr.ondataavailable = e => { if(e.data && e.data.size) recChunks.push(e.data); };
          mr.onstop = async ()=>{
            const blob = new Blob(recChunks, { type: 'audio/webm' });
            const arr = await blob.arrayBuffer();
            audioCtx.decodeAudioData(arr.slice(0), (buff)=>{
              recordedBuffer = buff;
              status.innerText = 'Recording saved';
            }, (err)=>{ console.warn('decode error', err); status.innerText = 'Recording saved (decode failed)'; });
          };
          mr.start();
          mediaRecorder = mr;
        } else {
          status.innerText = 'Recording (no MediaRecorder support)';
        }
      }catch(err){ console.error(err); status.innerText = 'Mic access denied'; }
    };

    stopRecBtn.onclick = ()=>{
      if(mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
      try { if(mediaStreamSource) mediaStreamSource.disconnect(); } catch(e){}
      status.innerText = 'Stopped recording';
    };

    playRecBtn.onclick = ()=>{
      if(recordedBuffer){
        if(bufferSource) try{ bufferSource.stop(); } catch(e){}
        bufferSource = audioCtx.createBufferSource();
        bufferSource.buffer = recordedBuffer;
        bufferSource.playbackRate.value = parseFloat(pitchEl.value || 1);
        bufferSource.connect(highFilter);
        connectNodes();
        bufferSource.start();
        status.innerText = 'Playing recorded buffer';
      } else {
        status.innerText = 'No recording yet';
      }
    };

    fileInput.onchange = (e)=>{
      const f = e.target.files && e.target.files[0];
      if(!f) return;
      ensureAudio();
      const url = URL.createObjectURL(f);
      if(bufferSource) try{ bufferSource.stop(); }catch(e){}
      bufferSource = audioCtx.createBufferSource();
      fetch(url).then(r=>r.arrayBuffer()).then(a=> audioCtx.decodeAudioData(a, (buff)=>{
        bufferSource.buffer = buff;
        bufferSource.loop = true;
        bufferSource.playbackRate.value = parseFloat(pitchEl.value || 1);
        bufferSource.connect(highFilter);
        connectNodes();
        bufferSource.start(0);
        status.innerText = 'Playing uploaded track';
      }, (err)=>{ console.error(err); status.innerText = 'Audio decode failed'; }));
    };

    demoBtn.onclick = ()=>{
      ensureAudio();
      if(bufferSource) try{ bufferSource.stop(); } catch(e){}
      fetch('demo.mp3').then(r=>{ if(!r.ok){ status.innerText = 'No demo.mp3 found'; throw 'nodemo'; } return r.arrayBuffer(); }).then(a=>{
        audioCtx.decodeAudioData(a, (buff)=>{
          bufferSource = audioCtx.createBufferSource();
          bufferSource.buffer = buff;
          bufferSource.loop = true;
          bufferSource.playbackRate.value = parseFloat(pitchEl.value || 1);
          bufferSource.connect(highFilter);
          connectNodes();
          bufferSource.start();
          status.innerText = 'Playing demo track';
        });
      }).catch(e=>{/* ignore */});
    };

    gainEl.oninput = ()=>{ ensureAudio(); masterGain.gain.value = parseFloat(gainEl.value); };
    lowEl.oninput = ()=>{ ensureAudio(); lowFilter.frequency.value = parseFloat(lowEl.value); };
    highEl.oninput = ()=>{ ensureAudio(); highFilter.frequency.value = parseFloat(highEl.value); };
    delayEl.oninput = ()=>{ ensureAudio(); delayNode.delayTime.value = parseFloat(delayEl.value)/1000; feedbackGain.gain.value = Math.min(0.8, parseFloat(delayEl.value)/800); };
    distEl.oninput = ()=>{ ensureAudio(); distNode.curve = makeDistortion(parseFloat(distEl.value)); };
    pitchEl.oninput = ()=>{ if(bufferSource) bufferSource.playbackRate.value = parseFloat(pitchEl.value); };

    regenBtn.onclick = ()=>{
      const count = Math.floor(Math.random()*300)+120;
      createStars(count);
      randPalette();
      status.innerText = 'AI Regenerated visuals';
    };

    const cmdInput = document.getElementById('command');
    cmdInput.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){
        const cmd = e.target.value.trim().toLowerCase();
        if(cmd === 'upgrade'){ randPalette(); createStars(stars.length); status.innerText = 'Upgraded color palette'; }
        else if(cmd === 'regenerate'){ const count = Math.floor(Math.random()*300)+120; createStars(count); randPalette(); status.innerText = 'AI Regenerated visuals'; }
        e.target.value = '';
      }
    });

    (function initAudioDefaults(){
      ensureAudio();
      masterGain.gain.value = 1;
      lowFilter.frequency.value = 12000;
      highFilter.frequency.value = 10;
      delayNode.delayTime.value = 0;
      feedbackGain.gain.value = 0;
      distNode.curve = makeDistortion(0);
      convolver.buffer = makeReverb(1.2, 3.0);
      connectNodes();
    })();
