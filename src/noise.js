class NoiseProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [{ name: "mode", defaultValue: 0, minValue: 0, maxValue: 2, automationRate: "k-rate" }];
    }

    constructor() {
        super();
        this.pinkB0 = 0.0;
        this.pinkB1 = 0.0;
        this.pinkB2 = 0.0;
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const mode = parameters.mode.length > 0 ? parameters.mode[0] : 0; // First element for k-rate

        for (let channel = 0; channel < output.length; channel++) {
            const outputChannel = output[channel];

            for (let i = 0; i < outputChannel.length; i++) {
                let white0 = Math.random() * 2 - 1;
                let white1 = Math.random() * 2 - 1;
                let white2 = Math.random() * 2 - 1;
                let pink0 = this.generatePink(white1);
                let pink1 = this.generatePink(white2);

                if (mode === 0) {
                    outputChannel[i] = white0;
                } else if (mode === 1) {
                    outputChannel[i] = pink1;
                } else if (mode === 2) {
                    outputChannel[i] = white0 * pink0 * pink1;
                }
            }
        }

        return true;
    }

    generatePink(white) {
        this.pinkB0 = 0.99886 * this.pinkB0 + white * 0.0555179;
        this.pinkB1 = 0.99332 * this.pinkB1 + white * 0.0750759;
        this.pinkB2 = 0.96900 * this.pinkB2 + white * 0.1538520;

        return this.pinkB0 + this.pinkB1 + this.pinkB2 + white * 0.3104856;
    }
}

registerProcessor("noise-processor", NoiseProcessor);
