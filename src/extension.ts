import * as vscode from "vscode";
import { registerTesla } from "./tesla/entry";

export function activate(context: vscode.ExtensionContext) {
  registerTesla(context);
}

export function deactivate() { }
