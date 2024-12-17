import { PitchDetector } from "https://esm.sh/pitchy@4";

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
                fftSize: this.inputBufferSize
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
        
        this.analyser.getByteFrequencyData(dataArray);

        this.canvasCtx.fillStyle = 'rgb(26, 26, 26)';
        this.canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.canvasCtx.lineWidth = 2;
        this.canvasCtx.strokeStyle = '#4CAF50';
        this.canvasCtx.beginPath();

        const barWidth = (this.canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const percent = dataArray[i] / 255;
            const height = this.canvas.height * percent;
            const y = this.canvas.height - height;

            if (i === 0) {
                this.canvasCtx.moveTo(x, y);
            } else {
                this.canvasCtx.lineTo(x, y);
            }

            x += barWidth;
        }

        this.canvasCtx.lineTo(this.canvas.width, this.canvas.height);
        this.canvasCtx.stroke();

        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        if (average > 0) {
            console.log('Audio level:', average);
        }
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
    new PitchGame();
}); 