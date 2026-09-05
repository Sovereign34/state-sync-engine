export const getAdvancedFingerprintScript = (): string => {
  return `
    // 1. Canvas Fingerprint Maskeleme (Gürültü Ekleme)
    const nativeToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type) {
      const width = this.width;
      const height = this.height;
      if (width > 0 && height > 0) {
        const ctx = this.getContext('2d');
        if (ctx) {
          const shift = (Math.random() - 0.5) * 0.05;
          ctx.fillStyle = \`rgba(0,0,0,\${shift})\`;
          ctx.fillRect(0, 0, 1, 1);
        }
      }
      return nativeToDataURL.apply(this, arguments);
    };

    const nativeGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
      const imgData = nativeGetImageData.apply(this, arguments);
      for (let i = 0; i < imgData.data.length; i += 10) {
        imgData.data[i] = imgData.data[i] ^ 1;
      }
      return imgData;
    };

    // 2. AudioContext Fingerprint Maskeleme
    if (window.AudioContext || window.webkitAudioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const nativeCreateAnalyser = AudioCtx.prototype.createAnalyser;
      AudioCtx.prototype.createAnalyser = function() {
        const analyser = nativeCreateAnalyser.apply(this, arguments);
        const nativeGetFloatFrequencyData = analyser.getFloatFrequencyData;
        analyser.getFloatFrequencyData = function(array) {
          nativeGetFloatFrequencyData.call(this, array);
          for (let i = 0; i < array.length; i++) {
            array[i] += (Math.random() - 0.5) * 0.1;
          }
        };
        return analyser;
      };
    }

    // 3. Donanım ve Platform Tutarlılığı
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en', 'tr'] });

    // 4. WebGL Vendor / Renderer Maskeleme
    const getParameterProxyHandler = {
      apply: function(target, ctx, args) {
        const param = args[0];
        if (param === 37445) return 'Intel Inc.';
        if (param === 37446) return 'Intel Iris OpenGL Engine';
        return Reflect.apply(target, ctx, args);
      }
    };

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
          gl.getParameter = new Proxy(gl.getParameter, getParameterProxyHandler);
        }
      }
    } catch (e) {}
  `;
};
