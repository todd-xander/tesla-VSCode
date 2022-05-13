import * as vscode from 'vscode';
import * as tjs from 'teslajs';
import * as auth from './auth';

function getTeslaToken(
  extension: vscode.ExtensionContext,
): Promise<string | undefined> {
  return new Promise<string | undefined>((resolve, reject) => {
    extension.secrets.get('Tesla.token').then((token) => {
      if (token !== undefined) {
        resolve(token);
      } else {
        resolve(undefined);
      }
    });
  });
}

export class TeslaSidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.Webview;
  private extension: vscode.ExtensionContext;
  private token?: string;
  public static readonly viewType = 'tesla.view';

  static register(context: vscode.ExtensionContext) {
    const ModelProvider = new TeslaSidebarProvider(context);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        TeslaSidebarProvider.viewType,
        ModelProvider,
        { webviewOptions: { retainContextWhenHidden: true } },
      ),
    );
  }

  constructor(private readonly _context: vscode.ExtensionContext) {
    this.extension = _context;
    vscode.commands.executeCommand('setContext', 'tesla.ctx.frozen', true);
    getTeslaToken(_context).then((token) => {
      this.token = token;
    });
    _context.subscriptions.push(
      vscode.commands.registerCommand('tesla.cmd.froze', () => {
        vscode.commands.executeCommand('setContext', 'tesla.ctx.frozen', true);
        this.showView(true);
      }),
    );
    _context.subscriptions.push(
      vscode.commands.registerCommand('tesla.cmd.logout', () => {
        _context.secrets.delete('Tesla.token').then(() => {
          this.token = undefined;
          vscode.commands.executeCommand('setContext', 'tesla.ctx.frozen', true);
          this.showUseGuide();
        });

      }),
    );
  }

  private optionCodesToCarType(codes: String[]): String[] {
    for (var v of codes) {
      if (v === 'MDLS' || v === 'MS03' || v === 'MS04' || v === 'MS05') { return ['ms', 'Model S']; }
      if (v === 'MS06') { return ['mx', 'Plaid 2021']; }
      if (v === 'MDLX') { return ['mx', 'Model X']; }
      if (v === 'MDL3') { return ['m3', 'Model 3']; }
      if (v === 'MDLY') { return ['my', 'Model Y']; }
    }
    return ["", ""];
  }

  private optionCodesToWheelType(codes: String[]): String[] {
    for (var v of codes) {
      if (v === 'W32P') { return [v, '20" Performance Wheels']; }
      if (v === 'W32D') { return [v, '20" Gray Performance Wheels']; }
      if (v === 'W33D') { return [v, '20" Black Performance Wheels 2021']; }
      if (v === 'W38B') { return [v, '18" Aero Wheels']; }
      if (v === 'W39B') { return [v, '19" Sport Wheels']; }
      if (v === 'W40B') { return [v, '18" Wheels']; }
      if (v === 'W41B') { return [v, '19" Wheels']; }
      if (v === 'WS90') { return [v, '19" Tempest Wheels']; }
      if (v === 'WT19') { return [v, '19" Wheels']; }
      if (v === 'WS10') { return [v, '21" Arachnid Wheels']; }
      if (v === 'WT20') { return [v, '20" Silver Slipstream Wheels']; }
      if (v === 'WT22') { return [v, '22" Silver Turbine Wheels']; }
      if (v === 'WTAB') { return [v, '21" Black Arachnid Wheels']; }
      if (v === 'WTAS') { return [v, '19" Silver Slipstream Wheels']; }
      if (v === 'WTD2') { return [v, '19" Sonic Carbon Slipstream Wheels (8.5 in)']; }
      if (v === 'WTDS') { return [v, '19" Grey Slipstream Wheels']; }
      if (v === 'WTNN') { return [v, '20" Nokian Winter Tires (non-studded)']; }
      if (v === 'WTNS') { return [v, '20" Nokian Winter Tires (studded)']; }
      if (v === 'WTP2') { return [v, '20" Pirelli Winter Tires']; }
      if (v === 'WTSC') { return [v, '20" Sonic Carbon Wheels']; }
      if (v === 'WTSD') { return [v, '20" Two-Tone Slipstream Wheels']; }
      if (v === 'WTSG') { return [v, '21" Turbine Wheels']; }
      if (v === 'WTSP') { return [v, '21" Turbine Wheels']; }
      if (v === 'WTSS') { return [v, '21" Turbine Wheels']; }
      if (v === 'WTHX') { return [v, '20" Turbine Wheels']; }
      if (v === 'WTTG') { return [v, '19" Cyclone Wheels']; }
      if (v === 'WTTB') { return [v, '19" Cyclone Wheels']; }
      if (v === 'WTTC') { return [v, '21" Sonic Carbon Twin Turbine Wheels']; }
      if (v === 'WTUT') { return [v, '22" Onyx Black Wheels']; }
      if (v === 'WTW2') { return [v, '19" Nokian Winter Wheel Set']; }
      if (v === 'WTW3') { return [v, '19" Pirelli Winter Wheel Set']; }
      if (v === 'WTW4') { return [v, '19" Winter Tire Set']; }
      if (v === 'WTW5') { return [v, '21" Winter Tire Set']; }
      if (v === 'WTW6') { return [v, '19" Nokian Winter Tires (studded)']; }
      if (v === 'WTW7') { return [v, '19" Nokian Winter Tires (non-studded)']; }
      if (v === 'WTW8') { return [v, '19" Pirelli Winter Tires']; }
      if (v === 'WTX1') { return [v, '19" Michelin Primacy Tire Upgrade']; }
      if (v === 'WX00') { return [v, '20" Cyberstream Wheels']; }
      if (v === 'WX20') { return [v, '22" Turbine Wheels']; }
      if (v === 'WXNN') { return [v, '20" Nokian Winter Tires (non-studded)']; }
      if (v === 'WXNS') { return [v, '20" Nokian Winter Tires (studded)']; }
      if (v === 'WXP2') { return [v, '20" Pirelli Winter Tires']; }
      if (v === 'WXW2') { return [v, '19" Wheels with Nokian Winter Tyres']; }
      if (v === 'WXW3') { return [v, '19" Wheels with Pirelli Winter Tyres']; }
      if (v === 'WXW4') { return [v, '19" Winter Tire Set']; }
      if (v === 'WXW5') { return [v, '21" Winter Tire Set']; }
      if (v === 'WXW6') { return [v, '19" Nokian Winter Tires (studded)']; }
      if (v === 'WXW7') { return [v, '19" Nokian Winter Tires (non-studded)']; }
      if (v === 'WXW8') { return [v, '19" Pirelli Winter Tires']; }
      if (v === 'WY0S') { return [v, '20" Induction']; }
      if (v === 'WY18B') { return [v, '18" Aero Wheels']; }
      if (v === 'WY1S') { return [v, '21" Uberturbine']; }
      if (v === 'WY9S') { return [v, '19" Apollo']; }
      if (v === 'WY19B') { return [v, '19" Sport Wheels']; }
      if (v === 'WY20P') { return [v, '20" Performance Wheels']; }
    }
    return ["", ""];
  }

  private optionCodesToPaintColor(codes: String[]): String[] {
    for (var v of codes) {
      if (v === 'PBCW') { return [v, ' Solid White Color']; }
      if (v === 'PBSB') { return [v, ' Solid Black Color']; }
      if (v === 'PMAB') { return [v, ' Anza Brown Metallic Color']; }
      if (v === 'PMBL') { return [v, ' Obsidian Black Multi-Coat Color']; }
      if (v === 'PMMB') { return [v, ' Monterey Blue Metallic Color']; }
      if (v === 'PMNG') { return [v, ' Midnight Silver Metallic Color']; }
      if (v === 'PMSG') { return [v, ' Green Metallic Color']; }
      if (v === 'PMSS') { return [v, ' San Simeon Silver Metallic Color']; }
      if (v === 'PMTG') { return [v, ' Dolphin Grey Metallic Color']; }
      if (v === 'PPMR') { return [v, ' Red Multi-Coat Color']; }
      if (v === 'PPSB') { return [v, ' Deep Blue Metallic Color']; }
      if (v === 'PPSR') { return [v, ' Signature Red Color']; }
      if (v === 'PPSW') { return [v, ' Pearl White Multi-Coat Color']; }
      if (v === 'PPTI') { return [v, ' Titanium Metallic Color']; }
    }
    return ["", ""];
  }
  private optionCodesToDriverPos(codes: String[]): String[] {
    for (var v of codes) {
      if (v === 'DRLH') { return [v, 'LeftHand']; }
      if (v === 'DRRH') { return [v, 'RightHand']; }
    }
    return ["", ""];
  }
  private optionCodesToDriveEngine(codes: String[]): String[] {
    for (var v of codes) {
      if (v === 'DV2W') { return [v, 'Rear-Wheel Drive']; }
      if (v === 'DV4W') { return [v, 'All-Wheel Drive']; }
    }
    return ["", ""];
  }
  private optionCodesToProductName(codes: String[]): String[] {
    for (var v of codes) {
      if (v === 'MT300') { return [v, "Standard Range Rear-Wheel Drive"]; }
      if (v === 'MT301') { return [v, "Standard Range Plus Rear-Wheel Drive"]; }
      if (v === 'MT302') { return [v, "Long Range Rear-Wheel Drive"]; }
      if (v === 'MT303') { return [v, "Long Range All-Wheel Drive"]; }
      if (v === 'MT304') { return [v, "Long Range All-Wheel Drive Performance"]; }
      if (v === 'MT305') { return [v, "Mid Range Rear-Wheel Drive"]; }
      if (v === 'MT307') { return [v, "Mid Range Rear-Wheel Drive"]; }
      if (v === 'MT308') { return [v, "Standard Range Plus Rear-Wheel Drive"]; }
      if (v === 'MT309') { return [v, "Standard Range Plus Rear-Wheel Drive"]; }
      if (v === 'MT310') { return [v, "Long Range All-Wheel Drive"]; }
      if (v === 'MT311') { return [v, "Long Range All-Wheel Drive Performance"]; }
      if (v === 'MT314') { return [v, "Standard Range Plus Rear-Wheel Drive"]; }
      if (v === 'MT315') { return [v, "Long Range All-Wheel Drive"]; }
      if (v === 'MT316') { return [v, "Long Range All-Wheel Drive"]; }
      if (v === 'MT317') { return [v, "Long Range All-Wheel Drive Performance"]; }
      if (v === 'MT320') { return [v, "Standard Range Plus Rear-Wheel Drive"]; }
      if (v === 'MT322') { return [v, "Standard Range Plus Rear-Wheel Drive"]; }
      if (v === 'MT321') { return [v, "Long Range All-Wheel Drive"]; }
      if (v === 'MT323') { return [v, "Long Range All-Wheel Drive"]; }
      if (v === 'MT328') { return [v, "Long Range All-Wheel Drive"]; }
      if (v === 'MT336') { return [v, "Standard Range Plus Rear-Wheel Drive"]; }
      if (v === 'MT337') { return [v, "Standard Range Plus Rear-Wheel Drive"]; }
      if (v === 'MT340') { return [v, "Long Range All-Wheel Drive Performance"]; }
      if (v === 'MTS01') { return [v, "Standard Range"]; }
      if (v === 'MTS03') { return [v, "Long Range"]; }
      if (v === 'MTS04') { return [v, "Performance"]; }
      if (v === 'MTS05') { return [v, "Long Range"]; }
      if (v === 'MTS06') { return [v, "Performance"]; }
      if (v === 'MTS07') { return [v, "Long Range Plus"]; }
      if (v === 'MTS08') { return [v, "Performance"]; }
      if (v === 'MTS09') { return [v, "Plaid+"]; }
      if (v === 'MTS10') { return [v, "Long Range"]; }
      if (v === 'MTS11') { return [v, "Plaid"]; }
      if (v === 'MTX01') { return [v, "Standard Range"]; }
      if (v === 'MTX03') { return [v, "Long Range"]; }
      if (v === 'MTX04') { return [v, "Performance"]; }
      if (v === 'MTX05') { return [v, "Long Range Plus"]; }
      if (v === 'MTX06') { return [v, "Performance"]; }
      if (v === 'MTX07') { return [v, "Long Range Plus"]; }
      if (v === 'MTX08') { return [v, "Performance"]; }
      if (v === 'MTX10') { return [v, "Long Range"]; }
      if (v === 'MTX11') { return [v, "Plaid"]; }
      if (v === 'MTY01') { return [v, "Standard Range Rear-Wheel Drive"]; }
      if (v === 'MTY02') { return [v, "Long Range Rear-Wheel Drive"]; }
      if (v === 'MTY03') { return [v, "Long Range All-Wheel Drive"]; }
      if (v === 'MTY04') { return [v, "Long Range All-Wheel Drive Performance"]; }
      if (v === 'MTY05') { return [v, "Long Range All-Wheel Drive Performance"]; }
      if (v === 'MTY07') { return [v, "Long Range All-Wheel Drive"]; }
      if (v === 'MTY09') { return [v, "Long Range All-Wheel Drive"]; }
    }
    return ["", ""];
  }
  private optionCodesToInterior(codes: String[]): String[] {
    for (var v of codes) {
      if (v === 'IN3BB') { return [v, "All Black Partial Premium Interior"]; }
      if (v === 'IBW0') { return [v, "Black and White Interior"]; }
      if (v === 'IBW1') { return [v, "Black and White Interior"]; }
      if (v === 'IN3BW') { return [v, "Black and White Interior"]; }
      if (v === 'IN3PB') { return [v, "All Black Premium Interior"]; }
      if (v === 'IN3PW') { return [v, "All White Premium Interior"]; }
      if (v === 'IBE00') { return [v, "Wood Décor & Black Interior"]; }
      if (v === 'ICW00') { return [v, "Wood Décor & Cream Interior"]; }
      if (v === 'IWW00') { return [v, "Wood Décor & Black and White Interior"]; }
      if (v === 'IBC00') { return [v, "Carbon Fiber Décor & Black Interior"]; }
      if (v === 'IWC00') { return [v, "Carbon Fiber Décor & Black and White Interior"]; }
      if (v === 'ICC00') { return [v, "Carbon Fiber Décor & Cream Interior"]; }
      if (v === 'INBBW') { return [v, "White Interior"]; }
      if (v === 'INB3C') { return [v, "Premium beige interior with oak wood finishes"]; }
      if (v === 'INBC3W') { return [v, "Premium black and white interior with Carbon Fiber decor"]; }
      if (v === 'INPB0') { return [v, "All Black Interior with Wood in door panel"]; }
      if (v === 'INPB1') { return [v, "All Black Interior"]; }
      if (v === 'INPW0') { return [v, "Black and White Interior with Wood in door panel"]; }
      if (v === 'INPW1') { return [v, "Black and White Interior"]; }
      if (v === 'INBFP') { return [v, "Classic Black Interior"]; }
      if (v === 'INBPP') { return [v, "Black Interior"]; }
      if (v === 'INBPW') { return [v, "White Seats Interior"]; }
      if (v === 'INBTB') { return [v, "Multi-Pattern Black Interior"]; }
      if (v === 'INFBP') { return [v, "Black Premium Interior"]; }
      if (v === 'INLPC') { return [v, "Cream Interior"]; }
      if (v === 'INLPP') { return [v, "Black / Light Headliner Interior"]; }
      if (v === 'INWPT') { return [v, "Tan Interior"]; }
      if (v === 'INYPB') { return [v, "All Black Premium Interior"]; }
      if (v === 'INYPW') { return [v, "Black and White Premium Interior"]; }
      if (v === 'IPB0') { return [v, "Black Interior"]; }
      if (v === 'IPB1') { return [v, "Black Interior"]; }
      if (v === 'IPW0') { return [v, "White Interior"]; }
      if (v === 'IPW1') { return [v, "white Interior"]; }
      if (v === 'IVBPP') { return [v, "All Black Interior"]; }
      if (v === 'IVBSW') { return [v, "Ultra White Interior"]; }
      if (v === 'IVBTB') { return [v, "All Black Interior"]; }
      if (v === 'IVLPC') { return [v, "Vegan Cream Interior"]; }
    }
    return ["", ""];
  }
  private optionCodesToSpoiler(codes: String[]): String[] {
    for (var v of codes) {
      if (v === 'SLR0') { return [v, 'No Rear Spoiler']; }
      if (v === 'SLR1') { return [v, 'Carbon Fibre Spoiler']; }
    }
    return ["", ""];
  }
  private async getVehicleInfo(vid: string, vehicle: tjs.Vehicle): Promise<any> {
    const baseUrl = this.view?.asWebviewUri(this.extension.extensionUri).path;
    let option: tjs.optionsType = {
      authToken: this.token || '',
      vehicleID: vid,
    };

    let opcodes = vehicle.option_codes as String;
    let codes = opcodes.split(',');
    let model = this.optionCodesToCarType(codes);
    let wheel = this.optionCodesToWheelType(codes);
    let color = this.optionCodesToPaintColor(codes);
    let engine = this.optionCodesToDriveEngine(codes);
    let interior = this.optionCodesToInterior(codes);
    let subtype = this.optionCodesToProductName(codes);
    let spoiler = this.optionCodesToSpoiler(codes);
    let view = 'STUD_SIDE';
    if (model[0] === 'my') {
      view = 'STUD_3QTR';
    }
    let cs = `${subtype[0]},${color[0]},${wheel[0]},${spoiler[0]},${interior[0]}`;
    const image = `https://static-assets.tesla.com/configurator/compositor?&options=${cs}&view=${view}&model=${model[0]}&size=400&bkba_opt=1`;

    if (vehicle.state === 'asleep') {
      return new Promise<any>((resolve, reject) => {
        let vd = { baseUrl, image };
        resolve(Object.assign(vd, vehicle));
      });
    } else {
      return tjs.vehicleDataAsync(option).then(result => {
        let v = result as any;
        let location = `https://www.google.com/maps/search/?api=1&query=${v.drive_state.corrected_latitude},${v.drive_state.corrected_longitude}`;
        if (codes.includes('COCN')) {
          location = `https://uri.amap.com/marker?position=${v.drive_state.corrected_longitude},${v.drive_state.corrected_latitude}&name=${v.display_name}`;
        }
        let driverPos = this.optionCodesToDriverPos(codes);
        let vd = { baseUrl, image, driverPosition: driverPos[1], location };
        let vv = Object.assign(vd, v);
        return vv;
      });
    }
  }

  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    webviewView.webview.options = {
      enableScripts: true,
    };
    if (!this.token) {
      this.token = await getTeslaToken(this.extension);
    }

    this.view = webviewView.webview;
    this.view.onDidReceiveMessage((data) => {
      switch (data.command) {
        case 'wakeup': {
          vscode.window.withProgress(
            {
              location: { viewId: TeslaSidebarProvider.viewType },
              title: 'Tesla',
            },
            async (progress, _token) => {
              if (this.token) {
                let option: tjs.optionsType = { authToken: this.token, vehicleID: data.vid };
                return tjs.wakeUpAsync(option).then(async (value) => {
                  let v: tjs.Vehicle = value as tjs.Vehicle;
                  while (v.state === 'asleep') {
                    await this.delay(3000);
                    tjs.vehicle(option, (err, data) => {
                      v = data;
                    });
                  }
                  this.getVehicleInfo(data.vid as string, v).then((info) => {
                    progress.report({ increment: 100 });
                    vscode.window.showInformationMessage(
                      `Vehicle ${v.display_name} waked up.`,
                    );
                    this.view?.postMessage({
                      command: 'vehicle',
                      data: info
                    });
                  });
                });
              } else {
                progress.report({ increment: 100 });
                return new Promise(() => { });
              }
            },
          );
          break;
        }
        case 'unfreeze': {
          vscode.commands.executeCommand('setContext', 'tesla.ctx.frozen', false);
          this.showView(false);
          break;
        }
        case 'update': {
          if (this.token) {
            let option: tjs.optionsType = { authToken: this.token, vehicleID: data.vid };
            tjs.vehicleAsync(option).then(async (value) => {
              this.getVehicleInfo(data.vid as string, value as tjs.Vehicle).then((info) => {
                this.view?.postMessage({
                  command: 'update',
                  data: info
                });
              });
            });
          }
          break;
        }
      }
    });

    this.showView(true);
  }

  private showUseGuide() {
    if (!this.view) {
      return;
    }
    this.view.onDidReceiveMessage((data) => {
      switch (data.command) {
        case 'login': {
          auth.loginPage(data.email).then((resp) => {
            this.view?.postMessage({ command: 'login-url', url: resp.url, verifier: resp.verifier });
          });
          break;
        }
        case 'verify': {
          auth.getToken({ url: data.url, verifier: data.verifier }).then((value) => {
            let token = value.data.access_token;
            this.extension.secrets.delete('Tesla.token');
            this.extension.secrets.store('Tesla.token', token).then(() => {
              this.token = token;
              vscode.commands.executeCommand('setContext', 'tesla.ctx.frozen', false);
              this.showView(false);
            });
          });
          break;
        }
      }
    });
    const cssUri = this.view.asWebviewUri(
      vscode.Uri.joinPath(
        this.extension.extensionUri,
        'media',
        'tesla',
        'sidebar.css',
      ),
    );
    const toolkitUri = this.view.asWebviewUri(
      vscode.Uri.joinPath(
        this.extension.extensionUri,
        'media',
        'common',
        'toolkit.js',
      ),
    );

    const logo = this.view.asWebviewUri(vscode.Uri.joinPath(this.extension.extensionUri, 'media', 'tesla-t.svg'));
    this.view.html = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${this.view.cspSource} https://*.tesla.com; font-src ${this.view.cspSource};  style-src ${this.view.cspSource} 'unsafe-inline'; script-src ${this.view.cspSource} 'unsafe-inline';" >
      <link href="${cssUri}" rel="stylesheet"/>
      <script type="module" src="${toolkitUri}"></script>
      <style>
       body {
          height:100vh;
          padding: 0 8px;
       }
       #logo {
          width: 100px;
          margin: 0 auto 40px auto;
          display: flex;
          filter: contrast(0.1);
       }
       #email, #url {
          width: 100%;
       }
       #tip {
          margin: 16px auto;
       }
       #tip.disabled {
          opacity: var(--disabled-opacity);
       }
       #tip.disabled #login-url {
          background-color: gray;
          cursor: default;
       }
       #login-url {
          border-radius: 50%;
          padding: 4px;
          background-color: red;
          cursor: pointer;
       }
       #tip img {
          width: 18px;
          margin-bottom: -6px;
       }
       #reset, #verify {
          display: inline-flex;
          width: calc(50% - 2px);
          margin-top: 20px;
       }
      </style>
    </head>
    <body>
      <div style='margin: 0 auto; padding-top: 50px; max-width: 260px;'>
        <img id='logo' src='${logo}'>
        <vscode-text-field type="email" id="email" name="email" placeholder="Tesla Account Email" onchange='login(event)'>1. Input account email</vscode-text-field>
        <div id='tip' class='disabled'>
        2. Login from 
        <a id='login-url'>
          <img src='${logo}'>
        </a>
        </div>
        <vscode-text-field type="url" id="url" name="url" placeholder="Tesla Verification URL" oninput='urlcheck(event)' disabled>3. Paste returned URL</vscode-text-field>
        <vscode-button title='Reset' appearance="secondary" id='reset' onclick='reset(event)' disabled>Reset</vscode-button>
        <vscode-button title='Verify Account' id='verify' onclick='verify(event)' disabled>Login</vscode-button>
      </div>
      <script>
        const vscode = acquireVsCodeApi();
        function login(ev) {
          var account = document.getElementById("email");
          vscode.postMessage({command: 'login', email: account.value});
        }
        function reset(event) {
          var account = document.getElementById("email");
          var tip = document.getElementById("tip");
          var url_tip = document.getElementById("login-url");
          var url = document.getElementById("url");
          var reset_btn = document.getElementById("reset");
          var verify_btn = document.getElementById("verify");
          account.value = '';
          account.disabled = false;
          url.value = '';
          url.disabled = true;
          url.dataset.verifier = undefined;
          tip.classList.add('disabled');
          reset_btn.disabled = true;
          verify_btn.disabled = true;
        }
        function urlcheck(ev) {
          var url = document.getElementById("url");
          var verify_btn = document.getElementById("verify");
          if (!url.dataset.verifier) {
            verify_btn.disabled = true;
            return;
          }
          if (url.value) {
            verify_btn.disabled = false;
          } else {
            verify_btn.disabled = true;
          }
        }
        function verify(ev) {
          var url = document.getElementById("url");
          vscode.postMessage({command: 'verify', url: url.value, verifier: url.dataset.verifier});
        }
        window.addEventListener("message", (event) => {
          const message = event.data;
          switch (message.command) {
            case "login-url": {
              var account = document.getElementById("email");
              var tip = document.getElementById("tip");
              var url_tip = document.getElementById("login-url");
              var url = document.getElementById("url");
              var reset_btn = document.getElementById("reset");
              url.dataset.verifier = message.verifier;
              account.disabled = true;
              url.disabled = false;
              url_tip.href = message.url;
              tip.classList.remove('disabled');
              reset_btn.disabled = false;
              break;
            }
          }
        });
      </script>
    </body>
    </html>`;
  }

  private async showView(froze: boolean) {
    if (!this.view) {
      return;
    }
    const meterialSymbolsUri = this.view.asWebviewUri(
      vscode.Uri.joinPath(
        this.extension.extensionUri,
        'media',
        'MeterialSymbols',
        'meterialSymbols.css',
      ),
    );
    const cssUri = this.view.asWebviewUri(
      vscode.Uri.joinPath(
        this.extension.extensionUri,
        'media',
        'tesla',
        'sidebar.css',
      ),
    );
    const jsUri = this.view.asWebviewUri(
      vscode.Uri.joinPath(
        this.extension.extensionUri,
        'media',
        'tesla',
        'sidebar.js',
      ),
    );
    const toolkitUri = this.view.asWebviewUri(
      vscode.Uri.joinPath(
        this.extension.extensionUri,
        'media',
        'common',
        'toolkit.js',
      ),
    );
    const eventHandler = this.view.asWebviewUri(
      vscode.Uri.joinPath(
        this.extension.extensionUri,
        'media',
        'common',
        'eventHandler.js',
      ),
    );
    const logo = this.view.asWebviewUri(
      vscode.Uri.joinPath(
        this.extension.extensionUri,
        'media',
        'tesla-t.svg',
      ),
    );

    if (!this.token) {
      this.showUseGuide();
      return;
    }
    this.view.html = '';
    tjs.vehicles(
      { authToken: this.token || '', vehicleID: '' },
      (err, data) => {
        if (err) {
          vscode.window.showErrorMessage(err.message);
          this.showUseGuide();
        } else {
          if (!this.view) {
            return;
          } else if (froze) {
            this.view.html = `<!DOCTYPE html>
            <html lang="en">
            <head>
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${this.view.cspSource} https://*.tesla.com; font-src ${this.view.cspSource};  style-src ${this.view.cspSource} 'unsafe-inline'; script-src ${this.view.cspSource} 'unsafe-inline';" >
            <link href="${meterialSymbolsUri}" rel="stylesheet" />
            <link href="${cssUri}" rel="stylesheet" />
            <script type="module" src="${toolkitUri}"></script>
            <script src="${eventHandler}"></script>
            <script src="${jsUri}"></script>
            </head>
            <body>
              <div style='height:100vh; padding: 0 8px'>
                <div>
                  <img src='${logo}' style='width: 100px; margin: 0 auto 50px auto; padding-top: 100px; display: flex; filter: contrast(0.1);'>
                </div>
                <vscode-button title='Unfreeze' data-command='unfreeze' class='big'>Unfreeze</vscode-button>
              </div>
            </body>
            </html>`;
            return;
          } else {
            let vehicleTab = '';
            let vehicleView = '';
            let vehicleIDs = [];
            for (let idx = 0; idx < data.length; idx++) {
              let v = data[idx];
              vehicleTab += `<vscode-panel-tab>${v.display_name}</vscode-panel-tab>`;
              vehicleIDs.push(v);
              vehicleView += `<vscode-panel-view id='${v.id_s}' class='container'>
                              </vscode-panel-view>`;
            }
            let panels = `<vscode-panels class='main'>${data.length > 1 ? vehicleTab : ""}${vehicleView}</vscode-panels>`;
            this.view.html = `<!DOCTYPE html>
            <html lang="en">
            <head>
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${this.view.cspSource} https://*.tesla.com; font-src ${this.view.cspSource};  style-src ${this.view.cspSource} 'unsafe-inline'; script-src ${this.view.cspSource} 'unsafe-inline';" >
            <link href="${meterialSymbolsUri}" rel="stylesheet" />
            <link href="${cssUri}" rel="stylesheet" />
            <script type="module" src="${toolkitUri}"></script>
            <script src="${eventHandler}"></script>
            <script src="${jsUri}"></script>
            </head>
            <body>
              ${panels}
            </body>
            </html>`;

            for (let idx = 0; idx < vehicleIDs.length; idx++) {
              let vehicle = vehicleIDs[idx];
              this.getVehicleInfo(vehicle.id_s, vehicle).then((value) => {
                this.view?.postMessage({
                  command: 'vehicle',
                  data: value
                });
              });
            }
          }
        }
      },
    );
  }

  private login(email: string): Promise<string | undefined> {
    return new Promise<string | undefined>((resolve, reject) => {
      auth.loginPage(email).then((resp) => {
        vscode.window.showInformationMessage(resp.url);
        vscode.window.showInputBox({ ignoreFocusOut: true, prompt: `Login from Tesla, and paste returned URL here.` }).then(v => {
          if (v) {
            resp.url = v;
            auth.getToken(resp).then((value) => {
              let token = value.data.access_token;
              this.extension.secrets.delete('Tesla.token');
              this.extension.secrets.store('Tesla.token', token).then(() => {
                this.token = token;
                vscode.commands.executeCommand('setContext', 'tesla.ctx.frozen', false);
                this.showView(false);
                resolve(token);
              });
            });
          }
        });
      });
    });
  }

  private verify(email: string): Promise<string | undefined> {
    return new Promise<string | undefined>((resolve, reject) => {
      auth.loginPage(email).then((resp) => {
        vscode.window.showInformationMessage(resp.url);
        vscode.window.showInputBox({ ignoreFocusOut: true, prompt: `Login from Tesla, and paste returned URL here.` }).then(v => {
          if (v) {
            resp.url = v;
            auth.getToken(resp).then((value) => {
              let token = value.data.access_token;
              this.extension.secrets.delete('Tesla.token');
              this.extension.secrets.store('Tesla.token', token).then(() => {
                this.token = token;
                vscode.commands.executeCommand('setContext', 'tesla.ctx.frozen', false);
                this.showView(false);
                resolve(token);
              });
            });
          }
        });
      });
    });
  }
}
