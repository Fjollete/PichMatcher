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
        this.scoreDisplay = document.getElementById('scoreElement');
        
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
                    autoGainControl: true
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(this.stream);
            
            this.microphone.connect(this.analyser);
            this.analyser.fftSize = 2048;
            
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
        this.analyser.getByteTimeDomainData(dataArray);

        this.canvasCtx.fillStyle = 'rgb(26, 26, 26)';
        this.canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.canvasCtx.lineWidth = 2;
        this.canvasCtx.strokeStyle = '#4CAF50';
        this.canvasCtx.beginPath();

        const sliceWidth = this.canvas.width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * this.canvas.height / 2;

            if (i === 0) {
                this.canvasCtx.moveTo(x, y);
            } else {
                this.canvasCtx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        this.canvasCtx.lineTo(this.canvas.width, this.canvas.height / 2);
        this.canvasCtx.stroke();
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
                document.getElementById('score').textContent = `Score: ${this.score}`;
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