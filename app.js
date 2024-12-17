import * as pitchy from 'https://cdn.jsdelivr.net/npm/pitchy@4.0.7/dist/pitchy.min.js';

class PitchGame {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.isPlaying = false;
        this.score = 0;
        this.targetPitch = null;
        this.stream = null;
        
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

            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;
            this.analyser.minDecibels = -90;
            this.analyser.maxDecibels = -10;

            this.microphone = this.audioContext.createMediaStreamSource(this.stream);
            this.microphone.connect(this.analyser);
            
            console.log('Audio input initialized:', this.analyser.frequencyBinCount);
            
            this.generateNewTarget();
            this.isPlaying = true;
            this.startBtn.textContent = 'Stop';
            
            this.update();
        } catch (error) {
            console.error('Error accessing microphone:', error);
            
            if (error.name === 'NotAllowedError') {
                alert('Microphone access was denied. Please allow microphone access in your browser settings.');
            } else if (error.name === 'NotFoundError') {
                alert('No microphone found. Please ensure your device has a working microphone.');
            } else {
                alert(`Error accessing microphone: ${error.message}`);
            }
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
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        this.analyser.getFloatTimeDomainData(dataArray);

        const [pitch, clarity] = pitchy.PitchDetector.findPitch(dataArray, this.audioContext.sampleRate);

        if (clarity > 0.8) {
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