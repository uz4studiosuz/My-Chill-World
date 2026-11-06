import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

/**
 * Records an MP4 (H.264) from pictures drawn on a canvas: the browser's own video encoder (WebCodecs) and an MP4
 * muxer — no screen recorder needed. Each frame is drawn by `draw` into a canvas of the video's size.
 */
export class Recorder {
  readonly canvas = document.createElement('canvas');
  readonly ctx: CanvasRenderingContext2D;
  frames = 0;
  private muxer: Muxer<ArrayBufferTarget>;
  private enc: VideoEncoder;
  private failed: Error | null = null;

  static supported() { return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'; }

  /** The first H.264 profile the browser can encode at this size (high, main, then baseline). */
  static async create(width: number, height: number, fps = 30): Promise<Recorder> {
    if (!Recorder.supported()) throw new Error('This browser cannot record video (use Chrome or Edge)');
    const bitrate = Math.round(width * height * fps * 0.11);
    for (const codec of ['avc1.640033', 'avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.42001f']) {
      const config: VideoEncoderConfig = { codec, width, height, bitrate, framerate: fps, latencyMode: 'quality', avc: { format: 'avc' } };
      try {
        const s = await VideoEncoder.isConfigSupported(config);
        if (s.supported) return new Recorder(width, height, fps, config);
      } catch { /* the next one */ }
    }
    throw new Error('No H.264 encoder in this browser');
  }

  private constructor(readonly width: number, readonly height: number, readonly fps: number, config: VideoEncoderConfig) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d')!;
    this.muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width, height, frameRate: fps }, fastStart: 'in-memory' });
    this.enc = new VideoEncoder({
      output: (chunk, meta) => this.muxer.addVideoChunk(chunk, meta),
      error: (e) => { this.failed = e; },
    });
    this.enc.configure(config);
  }

  /** Too many frames waiting for the encoder (a live recording skips a frame then). */
  get busy() { return this.enc.encodeQueueSize > 8; }

  /** Draw a frame and encode it at this time (microseconds from the start). */
  frame(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, timeUs: number) {
    if (this.failed) throw this.failed;
    draw(this.ctx, this.width, this.height);
    const f = new VideoFrame(this.canvas, { timestamp: Math.round(timeUs), duration: Math.round(1e6 / this.fps) });
    this.enc.encode(f, { keyFrame: this.frames % (this.fps * 2) === 0 });
    f.close();
    this.frames++;
  }

  /** Wait until the encoder has caught up (for recordings made faster or slower than real time). */
  async drain() {
    while (this.enc.encodeQueueSize > 2) await new Promise((r) => setTimeout(r, 5));
  }

  async finish(): Promise<Blob> {
    await this.enc.flush();
    this.enc.close();
    if (this.failed) throw this.failed;
    this.muxer.finalize();
    return new Blob([this.muxer.target.buffer], { type: 'video/mp4' });
  }

  cancel() {
    try { this.enc.close(); } catch { /* already closed */ }
  }
}
