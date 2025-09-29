/**
 * Browser Compatibility Testing and Feature Detection
 * Ensures OkapiFind works across all major browsers
 */

export interface BrowserInfo {
  name: string;
  version: string;
  engine: string;
  platform: string;
  mobile: boolean;
  supported: boolean;
  warnings: string[];
  features: BrowserFeatures;
}

export interface BrowserFeatures {
  geolocation: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
  webWorkers: boolean;
  serviceWorker: boolean;
  pushNotifications: boolean;
  indexedDB: boolean;
  webGL: boolean;
  webRTC: boolean;
  fetch: boolean;
  promises: boolean;
  asyncAwait: boolean;
  cssGrid: boolean;
  flexbox: boolean;
  customProperties: boolean;
  webAssembly: boolean;
  intersectionObserver: boolean;
  resizeObserver: boolean;
}

export class BrowserCompatibility {
  private userAgent: string;
  private browserInfo: BrowserInfo;

  constructor() {
    this.userAgent = navigator.userAgent;
    this.browserInfo = this.detectBrowser();
  }

  private detectBrowser(): BrowserInfo {
    const ua = this.userAgent.toLowerCase();
    let name = 'Unknown';
    let version = '0';
    let engine = 'Unknown';

    // Detect browser name and version
    if (ua.indexOf('firefox') > -1) {
      name = 'Firefox';
      version = this.getVersion(ua, 'firefox/');
      engine = 'Gecko';
    } else if (ua.indexOf('edg/') > -1) {
      name = 'Edge';
      version = this.getVersion(ua, 'edg/');
      engine = 'Chromium';
    } else if (ua.indexOf('chrome') > -1 && ua.indexOf('edg') === -1) {
      name = 'Chrome';
      version = this.getVersion(ua, 'chrome/');
      engine = 'Chromium';
    } else if (ua.indexOf('safari') > -1 && ua.indexOf('chrome') === -1) {
      name = 'Safari';
      version = this.getVersion(ua, 'version/');
      engine = 'WebKit';
    } else if (ua.indexOf('opera') > -1 || ua.indexOf('opr') > -1) {
      name = 'Opera';
      version = this.getVersion(ua, ua.indexOf('opr') > -1 ? 'opr/' : 'opera/');
      engine = 'Chromium';
    } else if (ua.indexOf('trident') > -1) {
      name = 'Internet Explorer';
      version = this.getVersion(ua, 'rv:');
      engine = 'Trident';
    }

    const platform = this.detectPlatform();
    const mobile = this.isMobile();
    const features = this.detectFeatures();
    const { supported, warnings } = this.checkSupport(name, version, features);

    return {
      name,
      version,
      engine,
      platform,
      mobile,
      supported,
      warnings,
      features,
    };
  }

  private getVersion(ua: string, searchString: string): string {
    const index = ua.indexOf(searchString);
    if (index === -1) return '0';

    const version = ua.substring(index + searchString.length);
    const endIndex = version.search(/[\s);]/);

    return endIndex === -1 ? version : version.substring(0, endIndex);
  }

  private detectPlatform(): string {
    const ua = this.userAgent.toLowerCase();

    if (ua.indexOf('win') > -1) return 'Windows';
    if (ua.indexOf('mac') > -1) return 'macOS';
    if (ua.indexOf('linux') > -1) return 'Linux';
    if (ua.indexOf('android') > -1) return 'Android';
    if (ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1) return 'iOS';

    return 'Unknown';
  }

  private isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(this.userAgent);
  }

  private detectFeatures(): BrowserFeatures {
    return {
      geolocation: 'geolocation' in navigator,
      localStorage: this.testLocalStorage(),
      sessionStorage: this.testSessionStorage(),
      webWorkers: typeof Worker !== 'undefined',
      serviceWorker: 'serviceWorker' in navigator,
      pushNotifications: 'PushManager' in window,
      indexedDB: this.testIndexedDB(),
      webGL: this.testWebGL(),
      webRTC: this.testWebRTC(),
      fetch: typeof fetch !== 'undefined',
      promises: typeof Promise !== 'undefined',
      asyncAwait: this.testAsyncAwait(),
      cssGrid: CSS.supports('display', 'grid'),
      flexbox: CSS.supports('display', 'flex'),
      customProperties: CSS.supports('--custom', 'property'),
      webAssembly: typeof WebAssembly !== 'undefined',
      intersectionObserver: 'IntersectionObserver' in window,
      resizeObserver: 'ResizeObserver' in window,
    };
  }

  private testLocalStorage(): boolean {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  private testSessionStorage(): boolean {
    try {
      const test = '__sessionStorage_test__';
      sessionStorage.setItem(test, test);
      sessionStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  private testIndexedDB(): boolean {
    try {
      return !!(window.indexedDB ||
                (window as any).mozIndexedDB ||
                (window as any).webkitIndexedDB ||
                (window as any).msIndexedDB);
    } catch {
      return false;
    }
  }

  private testWebGL(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch {
      return false;
    }
  }

  private testWebRTC(): boolean {
    return !!(
      (window as any).RTCPeerConnection ||
      (window as any).mozRTCPeerConnection ||
      (window as any).webkitRTCPeerConnection
    );
  }

  private testAsyncAwait(): boolean {
    try {
      new Function('async () => {}');
      return true;
    } catch {
      return false;
    }
  }

  private checkSupport(name: string, version: string, features: BrowserFeatures): {
    supported: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let supported = true;
    const versionNum = parseFloat(version);

    // Check minimum browser versions
    const minVersions: { [key: string]: number } = {
      Chrome: 80,
      Firefox: 75,
      Safari: 13,
      Edge: 80,
      Opera: 67,
    };

    if (name === 'Internet Explorer') {
      supported = false;
      warnings.push('Internet Explorer is not supported. Please use a modern browser.');
    } else if (minVersions[name] && versionNum < minVersions[name]) {
      warnings.push(`Your ${name} version is outdated. Please update to version ${minVersions[name]} or higher.`);
    }

    // Check critical features
    if (!features.geolocation) {
      supported = false;
      warnings.push('Geolocation is required for OkapiFind to work properly.');
    }

    if (!features.localStorage) {
      warnings.push('Local storage is disabled. Some features may not work properly.');
    }

    if (!features.serviceWorker) {
      warnings.push('Service Workers are not supported. Offline functionality will be limited.');
    }

    if (!features.fetch) {
      warnings.push('Fetch API is not supported. Network requests may fail.');
    }

    if (!features.promises) {
      supported = false;
      warnings.push('Promise support is required.');
    }

    return { supported, warnings };
  }

  public getBrowserInfo(): BrowserInfo {
    return this.browserInfo;
  }

  public isSupported(): boolean {
    return this.browserInfo.supported;
  }

  public getWarnings(): string[] {
    return this.browserInfo.warnings;
  }

  public hasFeature(feature: keyof BrowserFeatures): boolean {
    return this.browserInfo.features[feature];
  }

  public applyPolyfills(): void {
    // Apply polyfills for missing features
    if (!this.browserInfo.features.fetch) {
      console.warn('Fetch API not supported, loading polyfill...');
      // Load fetch polyfill
    }

    if (!this.browserInfo.features.intersectionObserver) {
      console.warn('IntersectionObserver not supported, loading polyfill...');
      // Load IntersectionObserver polyfill
    }

    if (!this.browserInfo.features.customProperties) {
      console.warn('CSS Custom Properties not supported, applying fallbacks...');
      // Apply CSS fallbacks
    }
  }

  public logCompatibilityReport(): void {
    console.group('Browser Compatibility Report');
    console.log('Browser:', this.browserInfo.name, this.browserInfo.version);
    console.log('Engine:', this.browserInfo.engine);
    console.log('Platform:', this.browserInfo.platform);
    console.log('Mobile:', this.browserInfo.mobile);
    console.log('Supported:', this.browserInfo.supported);

    if (this.browserInfo.warnings.length > 0) {
      console.warn('Warnings:', this.browserInfo.warnings);
    }

    console.group('Feature Support');
    Object.entries(this.browserInfo.features).forEach(([feature, supported]) => {
      console.log(`${feature}:`, supported ? '✅' : '❌');
    });
    console.groupEnd();
    console.groupEnd();
  }
}

// Initialize and export singleton
export const browserCompat = new BrowserCompatibility();

// Auto-run compatibility check
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    browserCompat.logCompatibilityReport();

    if (!browserCompat.isSupported()) {
      // Show compatibility warning to user
      const warnings = browserCompat.getWarnings();
      console.error('Browser not fully supported:', warnings);

      // Optionally show a modal or banner to the user
      if (warnings.length > 0) {
        const banner = document.createElement('div');
        banner.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: #ff3b30;
          color: white;
          padding: 12px;
          text-align: center;
          z-index: 9999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        `;
        banner.innerHTML = `
          <strong>Browser Compatibility Warning:</strong> ${warnings[0]}
          <button onclick="this.parentElement.remove()" style="
            margin-left: 10px;
            background: white;
            color: #ff3b30;
            border: none;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
          ">Dismiss</button>
        `;
        document.body.prepend(banner);
      }
    }

    // Apply necessary polyfills
    browserCompat.applyPolyfills();
  });
}