/*
	LibreSpeed - Main (Adapted for React/Vite)
	Original by Federico Dossena
	https://github.com/librespeed/speedtest/
	GNU LGPLv3 License
*/

export interface SpeedtestData {
  dlStatus: string;
  ulStatus: string;
  pingStatus: string;
  jitterStatus: string;
  dlProgress: number;
  ulProgress: number;
  pingProgress: number;
  testState: number;
  clientIp: string;
  testId?: string | null;
}

export class Speedtest {
  private _settings: any = {};
  private _state = 0; // 0=idle, 3=running, 4=done
  private worker: Worker | null = null;
  private updater: any = null;
  private _prevData: string | null = null;

  public onupdate: ((data: SpeedtestData) => void) | null = null;
  public onend: ((aborted: boolean) => void) | null = null;

  constructor() {
    console.log("LibreSpeed Engine Initialized");
  }

  getState() {
    return this._state;
  }

  setParameter(parameter: string, value: any) {
    if (this._state === 3) throw new Error("Cannot change settings while running");
    this._settings[parameter] = value;
  }

  start() {
    if (this._state === 3) throw new Error("Test already running");
    
    // In Vite, we can reference /speedtest_worker.js if it's in public folder
    this.worker = new Worker("/speedtest_worker.js?r=" + Math.random());
    
    this.worker.onmessage = (e) => {
      if (e.data === this._prevData) return;
      this._prevData = e.data;
      const data = JSON.parse(e.data) as SpeedtestData;
      
      if (this.onupdate) {
        try {
          this.onupdate(data);
        } catch (err) {
          console.error("onupdate error:", err);
        }
      }

      if (data.testState >= 4) {
        this.stopUpdater();
        this._state = 4;
        if (this.onend) {
          try {
            this.onend(data.testState === 5);
          } catch (err) {
            console.error("onend error:", err);
          }
        }
      }
    };

    this.updater = setInterval(() => {
      this.worker?.postMessage("status");
    }, 200);

    this._state = 3;
    this.worker.postMessage("start " + JSON.stringify(this._settings));
  }

  abort() {
    if (this._state < 3) return;
    if (this._state < 4) {
      this.worker?.postMessage("abort");
    }
    this.stopUpdater();
  }

  private stopUpdater() {
    if (this.updater) {
      clearInterval(this.updater);
      this.updater = null;
    }
  }
}
