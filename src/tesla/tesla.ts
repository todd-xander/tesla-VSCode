import * as vscode from 'vscode';
import * as tjs from 'teslajs';

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

interface VehicleInfo {
  id: string;
  info: {
    vin: string,
    name: string,
    model: string,
    color: string,
  };
  state?: object;
  climate?: object;
  charge?: object;
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
    getTeslaToken(_context).then((token) => {
      this.token = token;
    });
    _context.subscriptions.push(
      vscode.commands.registerCommand('tesla.cmd.logout', async () => {
        await _context.secrets.delete('Tesla.token');
        this.token = undefined;
        this.showView();
      }),
    );
  }

  private async getVehicleInfo(vid: string, vehicle: tjs.Vehicle): Promise<Object> {
    let option: tjs.optionsType = {
      authToken: this.token || '',
      vehicleID: vid,
    };

    if (vehicle.state === 'asleep') {
      return new Promise<Object>((resolve, reject) => {
        const imgUri = this.view?.asWebviewUri(vscode.Uri.joinPath(this.extension.extensionUri, 'media', 'cars.png'));
        let vd = { vehicle_config: { car_type: tjs.getModel(vehicle) }, image: imgUri ? `https://file%2B.vscode-resource.vscode-webview.net/${imgUri.fsPath.replace(':', '%3A')}` : "" };
        resolve(Object.assign(vd, vehicle));
      });
    } else {
      return tjs.vehicleDataAsync(option).then(v => {
        const imgUri = this.view?.asWebviewUri(vscode.Uri.joinPath(this.extension.extensionUri, 'media', 'cars.png'));
        let vd = { image: imgUri ? `https://file%2B.vscode-resource.vscode-webview.net/${imgUri.fsPath.replace(':', '%3A')}` : "" };
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

    this.showView();
  }

  private showUseGuide() {
    if (!this.view) {
      return;
    }
    this.view.onDidReceiveMessage((data) => {
      switch (data.command) {
        case 'login': {
          this.login();
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
    const eventHandler = this.view.asWebviewUri(
      vscode.Uri.joinPath(
        this.extension.extensionUri,
        'media',
        'common',
        'eventHandler.js',
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

    const imgUri = this.view.asWebviewUri(vscode.Uri.joinPath(this.extension.extensionUri, 'media', 'cars.png'));
    this.view.html = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${this.view.cspSource}; font-src ${this.view.cspSource};  style-src ${this.view.cspSource} 'unsafe-inline'; script-src ${this.view.cspSource} 'unsafe-inline';" >
      <link href="${cssUri}" rel="stylesheet"/>
      <script type="module" src="${toolkitUri}"></script>
      <script src="${eventHandler}"></script>
    </head>
    <body>
      <img class='car-img' src='${imgUri}'/>
      <vscode-button title='Login Tesla' data-command='login' style='width:100%'>Login</vscode-button>
    </body>
    </html>`;
  }

  private async showView() {
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
          } else {
            let vehicleTab = '';
            let vehicleView = '';
            let vehicleIDs = [];
            for (let idx = 0; idx < data.length; idx++) {
              let v = data[idx];
              vehicleTab += `<vscode-panel-tab>${v.display_name}</vscode-panel-tab>`;
              vehicleIDs.push(v);
              vehicleView += `<vscode-panel-view id='${v.id_s}' style='display: block'>
                              </vscode-panel-view>`;
            }
            let panels = `<vscode-panels>${vehicleTab}${vehicleView}</vscode-panels>`;
            this.view.html = `<!DOCTYPE html>
            <html lang="en">
            <head>
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${this.view.cspSource}; font-src ${this.view.cspSource};  style-src ${this.view.cspSource} 'unsafe-inline'; script-src ${this.view.cspSource} 'unsafe-inline';" >
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

  private login(): Promise<string | undefined> {
    return new Promise<string | undefined>((resolve, reject) => {
      vscode.window
        .showInputBox({
          placeHolder: 'Tesla Token',
        })
        .then((token) => {
          if (!token) {
            return resolve(undefined);
          }
          let ml = this;
          tjs.products({ authToken: token, vehicleID: '' }, (err, data) => {
            if (err) {
              vscode.window.showErrorMessage(err.message);
              ml.token = undefined;
              reject();
            } else {
              ml.extension.secrets.delete('Tesla.token');
              ml.extension.secrets.store('Tesla.token', token).then(() => {
                ml.token = token;
                ml.showView();
                resolve(token);
              });
            }
          });
        });
    });
  }
}
