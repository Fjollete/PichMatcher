import { PitchDetector } from "./lib/pitchy.js";

function checkBrowserSupport() {
    // Check for required features
    const requirements = {
        audioContext: 'AudioContext' in window || 'webkitAudioContext' in window,
        getUserMedia: navigator.mediaDevices && 'getUserMedia' in navigator.mediaDevices,
        modules: 'noModule' in HTMLScriptElement.prototype
    };

    const unsupported = Object.entries(requirements)
        .filter(([, supported]) => !supported)
        .map(([feature]) => feature);

    if (unsupported.length > 0) {
        throw new Error(
            `Your browser doesn't support the following required features: ${unsupported.join(', ')}. ` +
            'Please use a modern browser like Chrome, Firefox, or Edge.'
        );
    }
}

class PitchGame {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.isPlaying = false;
        this.score = 0;
        this.targetPitch = null;
        this.stream = null;
        this.detector = null;
        this.inputBuffer = null;
        
        // Configuration
        this.minVolumeDecibels = -10;
        this.minClarityPercent = 80;
        this.inputBufferSize = 2048;
        
        // Canvas setup
        this.canvas = document.getElementById('waveformCanvas');
        this.canvasCtx = this.canvas.getContext('2d');
        
        // UI elements
        this.startBtn = document.getElementById('startBtn');
        this.currentPitchDisplay = document.getElementById('currentPitch');
        this.targetPitchDisplay = document.getElementById('targetPitch');
        this.scoreDisplay = document.getElementById('score');
        
        // Bind methods
        this.startGame = this.startGame.bind(this);
        this.updatePitch = this.updatePitch.bind(this);
        this.drawWaveform = this.drawWaveform.bind(this);
        
        // Event listeners
        this.startBtn.addEventListener('click', this.startGame);
        
        // Set canvas size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    async startGame() {
        if (this.isPlaying) {
            this.stopGame();
            return;
        }

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            // Setup analyzer with specific buffer size
            this.analyser = new AnalyserNode(this.audioContext, {
                fftSize: 2048,
                smoothingTimeConstant: 0.8
            });
            
            this.microphone = this.audioContext.createMediaStreamSource(this.stream);
            this.microphone.connect(this.analyser);
            
            // Initialize pitch detector
            this.detector = PitchDetector.forFloat32Array(this.analyser.fftSize);
            this.detector.minVolumeDecibels = this.minVolumeDecibels;
            this.inputBuffer = new Float32Array(this.detector.inputLength);
            
            this.generateNewTarget();
            this.isPlaying = true;
            this.startBtn.textContent = 'Stop';
            
            this.update();
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert(`Error accessing microphone: ${error.message}`);
        }
    }

    stopGame() {
        if (this.audioContext) {
            this.audioContext.close();
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.isPlaying = false;
        this.startBtn.textContent = 'Start Game';
    }

    generateNewTarget() {
        // Generate a random pitch between 200 and 800 Hz
        this.targetPitch = Math.floor(Math.random() * (800 - 200) + 200);
        this.targetPitchDisplay.textContent = `Target: ${this.targetPitch.toFixed(1)} Hz`;
    }

    update() {
        if (!this.isPlaying) return;

        this.drawWaveform();
        this.updatePitch();
        requestAnimationFrame(() => this.update());
    }

    drawWaveform() {
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        this.analyser.getByteTimeDomainData(dataArray);

        this.canvasCtx.fillStyle = 'rgb(26, 26, 26)';
        this.canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.canvasCtx.lineWidth = 2;
        this.canvasCtx.strokeStyle = '#4CAF50';
        this.canvasCtx.beginPath();

        const sliceWidth = this.canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * (this.canvas.height / 2);

            if (i === 0) {
                this.canvasCtx.moveTo(x, y);
            } else {
                this.canvasCtx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        this.canvasCtx.stroke();
    }

    updatePitch() {
        if (!this.analyser || !this.detector || !this.audioContext || !this.inputBuffer) return;

        this.analyser.getFloatTimeDomainData(this.inputBuffer);
        const [pitch, clarity] = this.detector.findPitch(this.inputBuffer, this.audioContext.sampleRate);

        if (clarity >= this.minClarityPercent / 100) {
            const pitchInHz = pitch.toFixed(1);
            this.currentPitchDisplay.textContent = `${pitchInHz} Hz`;

            // Check if pitch matches target
            if (Math.abs(pitch - this.targetPitch) < 10) {
                this.score += 1;
                this.scoreDisplay.textContent = `Score: ${this.score}`;
                this.generateNewTarget();
            }
        }
    }

    resizeCanvas() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
    }
}

// Initialize the game when the page loads
window.addEventListener('load', () => {
    try {
        checkBrowserSupport();
        new PitchGame();
    } catch (error) {
        alert(error.message);
        // Optionally disable game UI here
    }
}); 