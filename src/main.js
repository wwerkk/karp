class AudioController {
  constructor() {
    this.audioContext = null;
    this.noiseNode = null;
    this.karpNode = null;
    this.outputGainNode = null;
    this.isPlaying = false;

    // UI elements
    this.toggleButton = document.getElementById('toggleButton');
    this.volumeSlider = document.getElementById('volumeSlider');
    this.volumeValue = document.getElementById('volumeValue');
    this.volumeIncrease = document.getElementById("volumeIncrease");
    this.volumeDecrease = document.getElementById("volumeDecrease");
    this.feedbackSlider = document.getElementById('feedbackSlider');
    this.resonanceSlider = document.getElementById('resonanceSlider');
    this.resonanceValue = document.getElementById('resonanceValue');
    this.dampingSlider = document.getElementById('dampingSlider');
    this.dampingValue = document.getElementById('dampingValue');
    this.feedbackValue = document.getElementById('feedbackValue');
    this.mixSlider = document.getElementById('mixSlider');
    this.mixValue = document.getElementById('mixValue');
    this.noiseModeRadios = document.querySelectorAll('input[name="noiseMode"]');
    this.noiseCutoffSlider = document.getElementById('noiseCutoffSlider');
    this.noiseCutoffValue = document.getElementById('noiseCutoffValue');
    this.noiseQSlider = document.getElementById('noiseQSlider');
    this.noiseQValue = document.getElementById('noiseQValue');

    // Bind methods
    this.initAudio = this.initAudio.bind(this);
    this.toggleKarp = this.toggleKarp.bind(this);
    this.updateVolume = this.updateVolume.bind(this);
    this.increaseVolume = this.increaseVolume.bind(this);
    this.decreaseVolume = this.decreaseVolume.bind(this);
    this.updateResonance = this.updateResonance.bind(this);
    this.updateDamping = this.updateDamping.bind(this);
    this.updateFeedback = this.updateFeedback.bind(this);
    this.updateMix = this.updateMix.bind(this);
    this.updateNoiseMode = this.updateNoiseMode.bind(this);
    this.updateNoiseCutoff = this.updateNoiseCutoff.bind(this);
    this.updateNoiseQ = this.updateNoiseQ.bind(this);

    // Add event listeners for changes and immediate input
    this.toggleButton.addEventListener('click', this.toggleKarp);

    this.volumeSlider.addEventListener('input', this.updateVolume);
    this.volumeIncrease.addEventListener("click", this.increaseVolume);
    this.volumeDecrease.addEventListener("click", this.decreaseVolume);
    this.resonanceSlider.addEventListener('input', this.updateResonance);
    this.dampingSlider.addEventListener('input', this.updateDamping);
    this.feedbackSlider.addEventListener('input', this.updateFeedback);
    this.mixSlider.addEventListener('input', this.updateMix);
    this.noiseModeRadios.forEach(radio => {
      radio.addEventListener('change', this.updateNoiseMode);
    });
    this.noiseCutoffSlider.addEventListener('input', this.updateNoiseCutoff);
    this.noiseQSlider.addEventListener('input', this.updateNoiseQ);

    // Initialize display values from HTML defaults
    this.updateVolume();
    this.updateResonance();
    this.updateDamping();
    this.updateFeedback();
    this.updateMix();
    this.updateNoiseMode();
    this.updateNoiseCutoff();
    this.updateNoiseQ();
  }

  async initAudio() {
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Add AudioWorklet module
      await this.audioContext.audioWorklet.addModule('./src/noise.js');
      await this.audioContext.audioWorklet.addModule('./src/karp.js');

      // Get current parameter values
      const resonanceFreq = parseInt(this.resonanceSlider.value);
      const dampingFreq = parseInt(this.dampingSlider.value);
      const feedbackAmount = parseInt(this.feedbackSlider.value) / 100;
      const selectedMode = document.querySelector('input[name="noiseMode"]:checked').value;
      const noiseMode = parseInt(selectedMode, 10);
      const noiseCutoff = parseInt(this.noiseCutoffSlider.value);
      const noiseQ = parseFloat(this.noiseQSlider.value);

      this.noiseNode = new AudioWorkletNode(this.audioContext, 'noise-processor', {
        processorOptions: {
          mode: noiseMode
        }
      });
      this.noiseModeParam = this.noiseNode.parameters.get('mode');
      this.noiseNode.port.start();

      this.filterNode = this.audioContext.createBiquadFilter();
      this.filterNode.type = 'bandpass';
      this.filterNode.Q.setValueAtTime(noiseQ, this.audioContext.currentTime);
      this.filterNode.frequency.setValueAtTime(noiseCutoff, this.audioContext.currentTime);
      this.karpNode = new AudioWorkletNode(this.audioContext, 'karp-processor', {
        processorOptions: {
          resonantFrequency: resonanceFreq, // Default from slider
          dampingFrequency: dampingFreq, // Default from slider
          feedbackAmount: feedbackAmount, // Default from slider
          sampleRate: this.audioContext.sampleRate
        }
      });

      // Set up parameter communication
      this.resonanceParam = this.karpNode.parameters.get('resonantFrequency');
      this.dampingParam = this.karpNode.parameters.get('dampingFrequency');
      this.feedbackParam = this.karpNode.parameters.get('feedbackAmount');

      // Always set up message port communication as fallback
      this.karpNode.port.start();

      // Create gain nodes for volume control
      this.noiseGainNode = this.audioContext.createGain();
      this.noiseGainNode.gain.value = 1 - this.mixSlider.value / 100;
      this.karpGainNode = this.audioContext.createGain();
      this.karpGainNode.gain.value = this.mixSlider.value / 100;
      this.outputGainNode = this.audioContext.createGain();
      this.outputGainNode.gain.value = Math.pow(this.volumeSlider.value / 100, 3);

      // Connect nodes
      this.noiseNode.connect(this.filterNode);
      this.filterNode.connect(this.karpNode);
      this.filterNode.connect(this.noiseGainNode);
      this.noiseGainNode.connect(this.outputGainNode);
      this.karpNode.connect(this.karpGainNode);
      this.karpGainNode.connect(this.outputGainNode);
      this.outputGainNode.connect(this.audioContext.destination);

      return true;
    } catch (error) {
      console.error('Error initializing audio:', error);
      alert('Failed to initialize audio. Check the console for details.');
      return false;
    }
  }

  async toggleKarp() {
    // Initialize audio context if needed
    if (!this.audioContext) {
      const initialized = await this.initAudio();
      if (!initialized) return;
    }

    if (this.isPlaying) {
      await this.audioContext.suspend();
      this.isPlaying = false;
      this.toggleButton.textContent = 'Start';
      this.toggleButton.classList.remove('active');
    } else {
      await this.audioContext.resume();
      this.isPlaying = true;
      this.toggleButton.textContent = 'Stop';
      this.toggleButton.classList.add('active');
    }
  }

  updateVolume() {
    const volumeValue = parseInt(this.volumeSlider.value);
    this.volumeValue.textContent = `${volumeValue}%`;

    if (this.outputGainNode) {
      this.outputGainNode.gain.setValueAtTime(Math.pow(this.volumeSlider.value / 100, 3), this.audioContext.currentTime);
    }
  }

  increaseVolume() {
    const slider = document.getElementById("volumeSlider");
    const volumeValue = Math.max(0, Math.min(parseInt(slider.value) + 1, slider.max));
    slider.value = volumeValue;
    document.getElementById("volumeValue").textContent = `${volumeValue}%`

    if (this.outputGainNode) {
      this.outputGainNode.gain.setValueAtTime(Math.pow(volumeValue / 100, 3), this.audioContext.currentTime);
    }
  }

  decreaseVolume() {
    const slider = document.getElementById("volumeSlider");
    const volumeValue = Math.max(0, Math.min(parseInt(slider.value) - 1, slider.max));
    slider.value = volumeValue;
    document.getElementById("volumeValue").textContent = `${volumeValue}%`

    if (this.outputGainNode) {
      this.outputGainNode.gain.setValueAtTime(Math.pow(volumeValue / 100, 3), this.audioContext.currentTime);
    }
  }

  updateResonance() {
    const resonanceValue = parseInt(this.resonanceSlider.value);
    this.resonanceValue.textContent = `${resonanceValue} Hz`;

    if (this.karpNode) {
      // Try to use AudioParam if available
      if (this.resonanceParam) {
        this.resonanceParam.setValueAtTime(resonanceValue, this.audioContext.currentTime);
      }

      // Always send message as fallback
      this.karpNode.port.postMessage({
        type: 'resonantFrequency',
        value: resonanceValue
      });
    }
  }

  updateDamping() {
    const dampingValue = parseInt(this.dampingSlider.value);
    this.dampingValue.textContent = `${dampingValue} Hz`;

    if (this.karpNode) {
      // Try to use AudioParam if available
      if (this.dampingParam) {
        this.dampingParam.setValueAtTime(dampingValue, this.audioContext.currentTime);
      }

      // Always send message as fallback
      this.karpNode.port.postMessage({
        type: 'dampingFrequency',
        value: dampingValue
      });
    }
  }

  updateFeedback() {
    const feedbackValue = parseInt(this.feedbackSlider.value);
    this.feedbackValue.textContent = `${feedbackValue}%`;
    let feedbackMapped = feedbackValue / 100;
    // feedbackMapped = feedbackMapped > 0 ? feedbackMapped / Math.pow(feedbackMapped, 1 / 1.2) : 0; // inv root mapping
    // feedbackMapped = // sin mapping

    if (this.karpNode) {
      // Try to use AudioParam if available
      if (this.feedbackParam) {
        this.feedbackParam.setValueAtTime(feedbackMapped, this.audioContext.currentTime);
      }

      // Always send message as fallback
      this.karpNode.port.postMessage({
        type: 'feedbackAmount',
        value: feedbackMapped
      });
    }
  }

  updateMix() {
    const mixValue = parseInt(this.mixSlider.value);
    this.mixValue.textContent = `${mixValue}%`;

    if (this.noiseGainNode && this.karpGainNode) {
      this.noiseGainNode.gain.setValueAtTime(1 - mixValue / 100, this.audioContext.currentTime);
      this.karpGainNode.gain.setValueAtTime(mixValue / 100, this.audioContext.currentTime);
    }
  }

  updateNoiseMode() {
    const selectedMode = document.querySelector('input[name="noiseMode"]:checked').value;
    const modeValue = parseInt(selectedMode, 10);
    if (this.noiseNode) {
      if (this.noiseModeParam) this.noiseModeParam.setValueAtTime(modeValue, this.audioContext.currentTime);

      this.noiseNode.port.postMessage({
        type: 'mode',
        value: modeValue
      });
    }
  }

  updateNoiseCutoff() {
    const noiseCutoffValue = parseInt(this.noiseCutoffSlider.value);
    if (isFinite(noiseCutoffValue)) {
      this.noiseCutoffValue.textContent = `${noiseCutoffValue} Hz`;
      if (this.filterNode) this.filterNode.frequency.setValueAtTime(noiseCutoffValue, this.audioContext.currentTime);
    }
  }

  updateNoiseQ() {
    const noiseQValue = parseFloat(this.noiseQSlider.value);
    this.noiseQValue.textContent = `${noiseQValue}`;
    if (this.filterNode) this.filterNode.Q.setValueAtTime(noiseQValue, this.audioContext.currentTime);
  }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AudioController();
});