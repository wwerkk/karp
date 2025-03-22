class WhiteNoiseProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'resonantFrequency',
        defaultValue: 196,
        minValue: 50,
        maxValue: 1000,
        automationRate: 'k-rate'
      },
      {
        name: 'dampingFrequency',
        defaultValue: 4000,
        minValue: 4000,
        maxValue: 8000,
        automationRate: 'k-rate'
      },
      {
        name: 'feedbackAmount',
        defaultValue: 0.95,
        minValue: 0,
        maxValue: 0.95,
        automationRate: 'k-rate'
      },
      {
        name: 'mixAmount',
        defaultValue: 1,
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate'
      }
    ];
  }

  constructor(options) {
    super();

    const processorOptions = options.processorOptions || {};
    this.sampleRate = processorOptions.sampleRate || 44100;

    this.prevFeedbackSample = 0;
    this.resonantFrequency = processorOptions.resonantFrequency || 196;
    this.dampingFrequency = processorOptions.dampingFrequency || 4000;
    this.feedbackAmount = processorOptions.feedbackAmount || 0.95;
    this.mixAmount = processorOptions.mixAmount || 1;

    this.delayLine = new Float32Array(Math.ceil(this.sampleRate / 50));
    this.delayWriteIndex = 0;
    this.delayLength = Math.round(this.sampleRate / this.resonantFrequency);

    // Pink noise state variables
    this.b0 = this.b1 = this.b2 = this.b3 = this.b4 = this.b5 = this.b6 = 0;

    this.port.onmessage = (event) => {
      const { type, value } = event.data;
      if (type === 'resonantFrequency') {
        this.resonantFrequency = value;
        this.updateDelayLength();
      } else if (type === 'dampingFrequency') {
        this.dampingFrequency = value;
      } else if (type === 'feedbackAmount') {
        this.feedbackAmount = value;
      } else if (type === 'mixAmount') {
        this.mixAmount = value;
      }
    };
  }

  updateDelayLength() {
    this.delayLength = Math.round(this.sampleRate / this.resonantFrequency);
    this.delayLength = Math.min(this.delayLength, this.delayLine.length - 1);
  }

  getDelayedSample() {
    let readIndex = this.delayWriteIndex - this.delayLength;
    if (readIndex < 0) {
      readIndex += this.delayLine.length;
    }
    return this.delayLine[readIndex];
  }

  generatePinkNoise() {
    let white = Math.random() * 2 - 1;
    this.b0 = 0.99886 * this.b0 + white * 0.0555179;
    this.b1 = 0.99332 * this.b1 + white * 0.0750759;
    this.b2 = 0.96900 * this.b2 + white * 0.1538520;
    this.b3 = 0.86650 * this.b3 + white * 0.3104856;
    this.b4 = 0.55000 * this.b4 + white * 0.5329522;
    this.b5 = -0.7616 * this.b5 - white * 0.0168980;
    return this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + white * 0.5362;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];

    const resonantFreq = parameters.resonantFrequency ? parameters.resonantFrequency[0] : this.resonantFrequency;
    const dampingFreq = parameters.dampingFrequency ? parameters.dampingFrequency[0] : this.dampingFrequency;
    const feedback = parameters.feedbackAmount ? parameters.feedbackAmount[0] : this.feedbackAmount;
    const mix = parameters.mixAmount ? parameters.mixAmount[0] : this.mixAmount;

    if (resonantFreq !== this.resonantFrequency) {
      this.resonantFrequency = resonantFreq;
      this.updateDelayLength();
    }
    if (dampingFreq !== this.dampingFrequency) this.dampingFrequency = dampingFreq;
    this.feedbackAmount = feedback;
    this.mixAmount = mix;

    this.feedbackFilterCoeff = 1.0 - Math.exp(-2.0 * Math.PI * this.dampingFrequency / this.sampleRate);

    for (let channel = 0; channel < output.length; channel++) {
      const outputChannel = output[channel];

      for (let i = 0; i < outputChannel.length; i++) {
        const pinkNoise = this.generatePinkNoise();

        let delayedSample = this.getDelayedSample();
        this.prevFeedbackSample = (1 - this.feedbackFilterCoeff) * this.prevFeedbackSample + this.feedbackFilterCoeff * delayedSample;
        delayedSample = this.prevFeedbackSample;

        const feedbackInput = pinkNoise + delayedSample * this.feedbackAmount;
        this.delayLine[this.delayWriteIndex] = feedbackInput;
        this.delayWriteIndex = (this.delayWriteIndex + 1) % this.delayLine.length;

        outputChannel[i] = pinkNoise * (1 - this.mixAmount) + delayedSample * this.mixAmount;
      }
    }

    return true;
  }
}

registerProcessor('white-noise-processor', WhiteNoiseProcessor);
