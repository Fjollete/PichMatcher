import FFT from './fft.js';

const DEFAULT_MIN_VOLUME_DECIBELS = -60;

export class PitchDetector {
  constructor(inputLength) {
    this.inputLength = inputLength;
    this.fft = new FFT(inputLength);
    this.minVolumeDecibels = DEFAULT_MIN_VOLUME_DECIBELS;
  }

  static forFloat32Array(length) {
    return new PitchDetector(length);
  }

  findPitch(input, sampleRate) {
    const nsdf = this.normalizedSquareDifference(input);
    const maxPositions = this.peakPicking(nsdf);
    const maxPosition = this.findBestPeak(maxPositions, nsdf);
    if (maxPosition === null) {
      return [0, 0];
    }
    const turningPointX = this.findTurningPoint(maxPosition, nsdf);
    const frequency = sampleRate / turningPointX;
    const clarity = nsdf[Math.round(turningPointX)];
    return [frequency, clarity];
  }

  normalizedSquareDifference(input) {
    const nsdf = new Float32Array(this.inputLength);
    for (let tau = 0; tau < this.inputLength; tau++) {
      let acf = 0;
      let divisorM = 0;
      for (let i = 0; i < this.inputLength - tau; i++) {
        acf += input[i] * input[i + tau];
        divisorM += input[i] * input[i] + input[i + tau] * input[i + tau];
      }
      nsdf[tau] = 2 * acf / divisorM;
    }
    return nsdf;
  }

  peakPicking(nsdf) {
    const maxPositions = [];
    let pos = 0;
    let curMaxPos = 0;
    let isPositive = false;

    while (pos < this.inputLength) {
      if (nsdf[pos] > 0 && !isPositive) {
        isPositive = true;
        curMaxPos = pos;
      } else if (nsdf[pos] <= 0 && isPositive) {
        isPositive = false;
        if (curMaxPos > 0) {
          maxPositions.push(curMaxPos);
        }
      } else if (isPositive && nsdf[pos] > nsdf[curMaxPos]) {
        curMaxPos = pos;
      }
      pos++;
    }
    return maxPositions;
  }

  findBestPeak(maxPositions, nsdf) {
    let highestAmplitude = -Infinity;
    let bestPosition = null;

    maxPositions.forEach((maxPosition) => {
      if (nsdf[maxPosition] > highestAmplitude) {
        highestAmplitude = nsdf[maxPosition];
        bestPosition = maxPosition;
      }
    });

    return bestPosition;
  }

  findTurningPoint(maxPosition, nsdf) {
    let delta = 0;
    while (maxPosition + delta < nsdf.length && maxPosition - delta > 0) {
      if (nsdf[maxPosition - delta] > nsdf[maxPosition + delta]) {
        return maxPosition - delta;
      } else if (nsdf[maxPosition - delta] < nsdf[maxPosition + delta]) {
        return maxPosition + delta;
      }
      delta++;
    }
    return maxPosition;
  }
} 