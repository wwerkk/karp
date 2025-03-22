// Main audio controller
class WhiteNoiseController {
    constructor() {
      this.audioContext = null;
      this.whiteNoiseNode = null;
      this.gainNode = null;
      this.isPlaying = false;
      
      // UI elements
      this.toggleButton = document.getElementById('toggleButton');
      this.volumeSlider = document.getElementById('volumeSlider');
      this.volumeValue = document.getElementById('volumeValue');
      this.feedbackSlider = document.getElementById('feedbackSlider');
      this.resonanceSlider = document.getElementById('resonanceSlider');
      this.resonanceValue = document.getElementById('resonanceValue');
      this.dampingSlider = document.getElementById('dampingSlider');
      this.dampingValue = document.getElementById('dampingValue');
      this.feedbackValue = document.getElementById('feedbackValue');
      this.mixSlider = document.getElementById('mixSlider');
      this.mixValue = document.getElementById('mixValue');
      
      // Bind methods
      this.initAudio = this.initAudio.bind(this);
      this.toggleNoise = this.toggleNoise.bind(this);
      this.updateVolume = this.updateVolume.bind(this);
      this.updateResonance = this.updateResonance.bind(this);
      this.updateDamping = this.updateDamping.bind(this);
      this.updateFeedback = this.updateFeedback.bind(this);
      this.updateMix = this.updateMix.bind(this);
      
      // Add event listeners for changes and immediate input
      this.toggleButton.addEventListener('click', this.toggleNoise);
      
      this.volumeSlider.addEventListener('input', this.updateVolume);
      this.resonanceSlider.addEventListener('input', this.updateResonance);
      this.dampingSlider.addEventListener('input', this.updateDamping);
      this.feedbackSlider.addEventListener('input', this.updateFeedback);
      this.mixSlider.addEventListener('input', this.updateMix);
      
      // Initialize display values from HTML defaults
      this.updateVolume();
      this.updateResonance();
      this.updateDamping();
      this.updateFeedback();
      this.updateMix();
    }
    
    async initAudio() {
      try {
        // Create audio context
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Add AudioWorklet module
        await this.audioContext.audioWorklet.addModule('./src/processor.js');
        
        // Get current parameter values
        const resonanceFreq = parseInt(this.resonanceSlider.value);
        const dampingFreq = parseInt(this.dampingSlider.value)
        const feedbackAmount = parseInt(this.feedbackSlider.value) / 100;
        const mixAmount = parseInt(this.mixSlider.value) / 100;
        
        // Create white noise node with parameters
        this.whiteNoiseNode = new AudioWorkletNode(this.audioContext, 'karp-processor', {
          processorOptions: {
            cutoffFrequency: 12000, // 12kHz lowpass filter
            resonantFrequency: resonanceFreq, // Default from slider
            dampingFreuqnecy: dampingFreq, // Default from slider
            feedbackAmount: feedbackAmount, // Default from slider
            mixAmount: mixAmount, // Default from slider
            sampleRate: this.audioContext.sampleRate
          }
        });
        
        // Set up parameter communication
        this.resonanceParam = this.whiteNoiseNode.parameters.get('resonantFrequency');
        this.dampingParam = this.whiteNoiseNode.parameters.get('dampingFrequency');
        this.feedbackParam = this.whiteNoiseNode.parameters.get('feedbackAmount');
        this.mixParam = this.whiteNoiseNode.parameters.get('mixAmount');
        
        // Always set up message port communication as fallback
        this.whiteNoiseNode.port.start();
        
        // Create gain node for volume control
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = this.volumeSlider.value / 100;
        
        // Connect nodes
        this.whiteNoiseNode.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
        
        return true;
      } catch (error) {
        console.error('Error initializing audio:', error);
        alert('Failed to initialize audio. Check the console for details.');
        return false;
      }
    }
    
    async toggleNoise() {
      // Initialize audio context if needed
      if (!this.audioContext) {
        const initialized = await this.initAudio();
        if (!initialized) return;
      }
      
      if (this.isPlaying) {
        // Stop noise
        await this.audioContext.suspend();
        this.isPlaying = false;
        this.toggleButton.textContent = 'Start';
        this.toggleButton.classList.remove('active');
      } else {
        // Start noise
        await this.audioContext.resume();
        this.isPlaying = true;
        this.toggleButton.textContent = 'Stop';
        this.toggleButton.classList.add('active');
      }
    }
    
    updateVolume() {
      const volumeValue = this.volumeSlider.value;
      this.volumeValue.textContent = `${volumeValue}%`;
      
      if (this.gainNode) {
        this.gainNode.gain.value = volumeValue / 100;
      }
    }
    
    updateResonance() {
      const resonanceValue = parseInt(this.resonanceSlider.value);
      this.resonanceValue.textContent = `${resonanceValue} Hz`;
      
      if (this.whiteNoiseNode) {
        // Try to use AudioParam if available
        if (this.resonanceParam) {
          this.resonanceParam.setValueAtTime(resonanceValue, this.audioContext.currentTime);
        }
        
        // Always send message as fallback
        this.whiteNoiseNode.port.postMessage({
          type: 'resonantFrequency',
          value: resonanceValue
        });
      }
    }

    updateDamping() {
      const dampingValue = parseInt(this.dampingSlider.value);
      this.dampingValue.textContent = `${dampingValue} Hz`;
      
      if (this.whiteNoiseNode) {
        // Try to use AudioParam if available
        if (this.dampingParam) {
          this.dampingParam.setValueAtTime(dampingValue, this.audioContext.currentTime);
        }
        
        // Always send message as fallback
        this.whiteNoiseNode.port.postMessage({
          type: 'dampingFrequency',
          value: dampingValue
        });
      }
    }
    
    updateFeedback() {
      const feedbackValue = parseInt(this.feedbackSlider.value);
      this.feedbackValue.textContent = `${feedbackValue}%`;
      
      if (this.whiteNoiseNode) {
        // Try to use AudioParam if available
        if (this.feedbackParam) {
          this.feedbackParam.setValueAtTime(feedbackValue / 100, this.audioContext.currentTime);
        }
        
        // Always send message as fallback
        this.whiteNoiseNode.port.postMessage({
          type: 'feedbackAmount',
          value: feedbackValue / 100
        });
      }
    }
    
    updateMix() {
      const mixValue = parseInt(this.mixSlider.value);
      this.mixValue.textContent = `${mixValue}%`;
      
      if (this.whiteNoiseNode) {
        // Try to use AudioParam if available
        if (this.mixParam) {
          this.mixParam.setValueAtTime(mixValue / 100, this.audioContext.currentTime);
        }
        
        // Always send message as fallback
        this.whiteNoiseNode.port.postMessage({
          type: 'mixAmount',
          value: mixValue / 100
        });
      }
    }
  }
  
  // Initialize the app when the DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    new WhiteNoiseController();
  });