class KarpProcessor extends AudioWorkletProcessor {
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
        defaultValue: 0,
        minValue: 0,
        maxValue: 0.95,
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
    this.feedbackAmount = processorOptions.feedbackAmount || 1;

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

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    const resonantFreq = parameters.resonantFrequency ? parameters.resonantFrequency[0] : this.resonantFrequency;
    const dampingFreq = parameters.dampingFrequency ? parameters.dampingFrequency[0] : this.dampingFrequency;
    const feedback = parameters.feedbackAmount ? parameters.feedbackAmount[0] : this.feedbackAmount;

    if (resonantFreq !== this.resonantFrequency) {
      this.resonantFrequency = resonantFreq;
      this.updateDelayLength();
    }
    if (dampingFreq !== this.dampingFrequency) this.dampingFrequency = dampingFreq;
    this.feedbackAmount = feedback;

    this.feedbackFilterCoeff = 1.0 - Math.exp(-2.0 * Math.PI * this.dampingFrequency / this.sampleRate);

    for (let channel = 0; channel < output.length; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];

      for (let i = 0; i < outputChannel.length; i++) {
        let delayedSample = this.getDelayedSample();
        this.prevFeedbackSample = (1 - this.feedbackFilterCoeff) * this.prevFeedbackSample + this.feedbackFilterCoeff * delayedSample;
        delayedSample = this.prevFeedbackSample;

        const feedbackInput = inputChannel[i] + delayedSample * this.feedbackAmount;
        this.delayLine[this.delayWriteIndex] = feedbackInput;
        this.delayWriteIndex = (this.delayWriteIndex + 1) % this.delayLine.length;

        outputChannel[i] = delayedSample;
      }
    }

    return true;
  }
}

registerProcessor('karp-processor', KarpProcessor);
