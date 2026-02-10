import { Config } from '@remotion/cli/config';

// Video output format
Config.setVideoImageFormat('png');

// Overwrite existing output files
Config.setOverwriteOutput(true);

// Number of concurrent frames to render (adjust based on server resources)
Config.setConcurrency(2);

// Video codec - H.264 for best compatibility
Config.setCodec('h264');

// Pixel format - yuv420p for maximum player compatibility
Config.setPixelFormat('yuv420p');

export default Config;
