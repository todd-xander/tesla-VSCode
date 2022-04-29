import * as vscode from "vscode";

import { TeslaSidebarProvider } from "./tesla";

export function registerTesla(context: vscode.ExtensionContext) {
  TeslaSidebarProvider.register(context);
}
