let poll = {};

function startPollingVehicleState(vid, interval) {
  stopPollingVehicleState(vid);
  vscode.postMessage({
    command: "update",
    vid: vid,
  });
  let p = setInterval(() => {
    vscode.postMessage({
      command: "update",
      vid: vid,
    });
  }, interval);
  poll[vid] = p;
}

function stopPollingVehicleState(vid) {
  let p = poll[vid];
  if (p) {
    clearInterval(p);
    poll[vid] = undefined;
  }
}

function toggleAutoRenew(ev) {
  ev.currentTarget.classList.toggle("enable");
  let polling = ev.currentTarget.classList.contains("enable");
  ev.currentTarget.innerHTML = `<span class="material-symbols-outlined">
                                  ${polling ? "sync" : "sync_disabled"}
                                </span>`;
  if (polling) {
    startPollingVehicleState(ev.currentTarget.dataset.vid, 5000);
  } else {
    stopPollingVehicleState(ev.currentTarget.dataset.vid);
  }
}

function buildBasicInfo(infoView, vv) {
  let loc = "";
  let ts = "";
  let drive = "";
  if (vv.state !== "asleep") {
    let tip = "Location: ";
    let lat = vv.drive_state.corrected_latitude;
    if (lat >= 0) {
      tip += `${lat}N`;
    } else {
      tip += `${lat * -1}S`;
    }
    let lng = vv.drive_state.corrected_longitude;
    if (lat >= 0) {
      tip += `,${lng}E`;
    } else {
      tip += `,${lng * -1}W`;
    }
    loc = `<a class='locIcon' title='${tip}' href='${vv.location}'>
            <span class="material-symbols-outlined">explore</span>
          </a>`;
    ts = `<span class='timestamp'>
            ${new Date(vv.vehicle_state.timestamp).toLocaleString()}
          </span>`;

    let shift = vv.drive_state.shift_state || "P";

    drive = `<div class='drive-info'>`;
    drive += ["P", "R", "N", "D"]
      .map((v, i, arr) => {
        if (shift === v) {
          return `<span class='shift-state enable'>${v}</span>`;
        }
        return `<span class='shift-state'>${v}</span>`;
      })
      .join("");

    if (shift === "D" || shift === "R") {
      if (vv.gui_settings.gui_distance_units === "km/hr") {
        drive += `<span>
              ${Math.floor(vv.drive_state.speed * 1.609344 + 0.5)}km/h
            </span>`;
      } else {
        drive += `<span>${vv.drive_state.speed}mi/h</span>`;
      }
    }

    drive += `</div>`;
  }

  let basicInfo = `
  <h1 class='banner'>${vv.display_name}${loc}</h1>
  ${drive}
  ${ts}
  <img class='car-img' src='${vv.image}'/>`;

  if (vv.state == "asleep") {
    infoView.innerHTML = `
    ${basicInfo}
    <vscode-button title='Wakeup ${vv.display_name}' data-command='wakeup' class='big' data-vid='${vv.id_s}'>Wakeup</vscode-button>
    `;
    return;
  }

  let batteryIcon = "";
  if (vv.charge_state.battery_level == 100) {
    batteryIcon = "battery_full";
  } else if (vv.charge_state.battery_level < 10) {
    batteryIcon = "battery_alert";
  } else {
    let lvl = Math.floor((vv.charge_state.battery_level + 5) / 15);
    batteryIcon = `battery_${lvl}_bar`;
  }
  let range = `${Math.floor(vv.charge_state.battery_range + 0.5)}mi`;
  if (vv.gui_settings.gui_distance_units === "km/hr") {
    range = `${Math.floor(vv.charge_state.battery_range * 1.609344 + 0.5)}km`;
  }

  let temp = `${Math.floor(vv.climate_state.inside_temp + 0.5)}°C`;
  if (vv.gui_settings.gui_temperature_units === "F") {
    temp = `${Math.floor(vv.climate_state.inside_temp * 1.8 + 32.5)}°F`;
  }
  infoView.innerHTML = `
    ${basicInfo}
    <div class='state-info'>
      <span>
        <span class="material-symbols-outlined">${batteryIcon}</span>
        ${vv.charge_state.battery_level}%
      </span>
      <span>
        <span class="material-symbols-outlined">speed</span>
        ${range}
      </span>
      <span>
        <span class="material-symbols-outlined">device_thermostat</span>
        ${temp}
      </span>
    </div>
    `;
}

function buildShortcutView(shortcutView, vv) {
  if (vv.state == "asleep") {
    shortcutView.innerHTML = "";
    return;
  }
  let lockBtn =
    "<vscode-button class='shortcut' title='Unlocked'><span class='material-symbols-outlined'>key</span></vscode-button>";
  if (vv.vehicle_state.locked) {
    lockBtn =
      "<vscode-button class='shortcut' appearance='secondary' title='Locked'><span class='material-symbols-outlined'>key_off</span></vscode-button>";
  }

  let startupBtn =
    "<vscode-button class='shortcut' appearance='secondary' title='Standby'><span class='material-symbols-outlined'>settings_remote</span></vscode-button>";
  if (vv.vehicle_state.remote_start) {
    startupBtn =
      "<vscode-button class='shortcut' title='Startup'><span class='material-symbols-outlined'>settings_remote</span></vscode-button>";
  }

  let climateBtn =
    "<vscode-button class='shortcut' appearance='secondary' title='Climate Off'><span class='material-symbols-outlined'>mode_fan_off</span></vscode-button>";
  if (vv.climate_state.is_climate_on) {
    climateBtn =
      "<vscode-button class='shortcut' title='Climate On'><span class='material-symbols-outlined'>mode_fan</span></vscode-button>";
  }

  let chargeBtn =
    "<vscode-button class='shortcut' appearance='secondary' title='Charger Disconnected'><span class='material-symbols-outlined'>power_off</span></vscode-button>";
  if (
    vv.charge_state.charge_port_door_open &&
    vv.charge_state.charge_port_latch === "Engaged"
  ) {
    if (vv.charge_state.charging_state === "Stopped") {
      chargeBtn =
        "<vscode-button class='shortcut' title='Chager Connected'><span class='material-symbols-outlined'>power</span></vscode-button>";
    } else if (vv.charge_state.charging_state === "Complete") {
      chargeBtn =
        "<vscode-button class='shortcut' title='Charge Complete'><span class='material-symbols-outlined'>bolt</span></vscode-button>";
    } else {
      chargeBtn =
        "<vscode-button class='shortcut charging' title='Charging'><span class='material-symbols-outlined'>bolt</span></vscode-button>";
    }
  }

  let hornBtn =
    "<vscode-button class='shortcut' appearance='secondary' title='Honk Horn'><span class='material-symbols-outlined'>volume_up</span></vscode-button>";
  let falshBtn =
    "<vscode-button class='shortcut' appearance='secondary' title='Flash Headlights'><span class='material-symbols-outlined'>online_prediction</span></vscode-button>";
  let defrost =
    "<vscode-button class='shortcut' appearance='secondary' title='Defrost Off'><span class='material-symbols-outlined'>astrophotography_off</span></vscode-button>";
  if (vv.climate_state.defrost_mode == 1) {
    defrost =
      "<vscode-button class='shortcut' title='Defrost On'><span class='material-symbols-outlined'>auto_awesome</span></vscode-button>";
  }

  let frunk =
    "<vscode-button class='shortcut' appearance='secondary' title='Open Frunk'><span class='material-symbols-outlined'>backpack</span></vscode-button>";
  if (vv.vehicle_state.ft !== 0) {
    frunk =
      "<vscode-button class='shortcut' title='Frunk Opened'><span class='material-symbols-outlined'>backpack</span></vscode-button>";
  }
  let trunk =
    "<vscode-button class='shortcut' appearance='secondary' title='Open Trunk'><span class='material-symbols-outlined'>luggage</span></vscode-button>";
  if (vv.vehicle_state.rt !== 0) {
    trunk =
      "<vscode-button class='shortcut' title='Trunk Opened'><span class='material-symbols-outlined'>luggage</span></vscode-button>";
  }

  shortcutView.innerHTML = `
        <vscode-divider></vscode-divider>
        <div class='shortcuts'>
          ${lockBtn}
          ${climateBtn}
          ${defrost}
          ${chargeBtn}
          ${hornBtn}
          ${falshBtn}
          ${frunk}
          ${trunk}
        </div>
        <vscode-divider></vscode-divider>
        `;
}

function buildControlPanels(controlView, vv) {
  if (vv.state == "asleep") {
    controlView.innerHTML = "";
    return;
  }

  controlView.innerHTML = `
    <vscode-panels>
    <vscode-panel-tab title='Aaction'><span class="material-symbols-outlined">directions_car</span></vscode-panel-tab>
    <vscode-panel-tab title='Climate'><span class="material-symbols-outlined">ac_unit</span></vscode-panel-tab>
    <vscode-panel-tab title='Charge'><span class="material-symbols-outlined">electrical_services</span></vscode-panel-tab>
    <vscode-panel-tab title='Security'><span class="material-symbols-outlined">security</span></vscode-panel-tab>
    <vscode-panel-tab title='JSON Response'><span class="material-symbols-outlined">data_object</span></vscode-panel-tab>
    <vscode-panel-view></vscode-panel-view>
    <vscode-panel-view></vscode-panel-view>
    <vscode-panel-view></vscode-panel-view>
    <vscode-panel-view></vscode-panel-view>
    <vscode-panel-view><div class='json-response' style='user-select: text;'></div></vscode-panel-view>
    </vscode-panels>
  `;

  var detail = controlView.querySelector(".json-response");
  detail.innerText = `${JSON.stringify(vv, null, 2)}`;
}

function buildFooter(footerView, vv) {
  if (vv.state == "asleep") {
    footerView.innerHTML = "";
    return;
  }

  let car_type = vv.vehicle_config.car_type;
  car_type = car_type.toUpperCase();

  let odo = ` ${Math.floor(vv.vehicle_state.odometer + 0.5)}mi`;
  if (vv.gui_settings.gui_distance_units === "km/hr") {
    odo = `${Math.floor(vv.vehicle_state.odometer * 1.609344 + 0.5)}km`;
  }
  let update = "";
  if (vv.vehicle_state.software_update.status === "available") {
    update = `<div class='update'><span title='Update available" class="material-symbols-outlined">
                download_for_offline
              </span>
              </div>`;
  } else if (vv.vehicle_state.software_update.status === "scheduled") {
    update = `<div class='update'>
              <span class="material-symbols-outlined">
                download_for_offline
              </span>
              <div class="progressbar" title='Update downloading: ${vv.vehicle_state.software_update.download_perc}%'>
                <div style="width:${vv.vehicle_state.software_update.download_perc}%"></div>
              </div>
              </div>`;
  } else if (vv.vehicle_state.software_update.status === "installing") {
    update = `<div class='update'>
              <span class="material-symbols-outlined">
                build_circle
              </span>
              <div class="progressbar" title='Update installing: ${vv.vehicle_state.software_update.install_perc}%'>
                <div style="width:${vv.vehicle_state.software_update.install_perc}%"></div>
              </div>
              </div>`;
  }
  footerView.innerHTML = `
      <vscode-divider></vscode-divider>
      <vscode-data-grid-row>
        <vscode-data-grid-cell grid-column="1">${car_type} ${odo}</vscode-data-grid-cell>
      </vscode-data-grid-row>
      <vscode-data-grid-row>
        <vscode-data-grid-cell grid-column="1">VIN: ${vv.vin}</vscode-data-grid-cell>
      </vscode-data-grid-row>
      <vscode-data-grid-row>
        <vscode-data-grid-cell grid-column="1">VER: ${vv.vehicle_state.car_version}</vscode-data-grid-cell>
      </vscode-data-grid-row>
      ${update}
  `;
}

function buildFramework(view, data) {
  stopPollingVehicleState(data.id_s);
  view.innerHTML = `<vscode-data-grid class="view-grid" generate-header="none" aria-label="No Header">
          <vscode-data-grid-row>
            <vscode-data-grid-cell grid-column="1" class="info-view"></vscode-data-grid-cell>
          </vscode-data-grid-row>
          <vscode-data-grid-row>
            <vscode-data-grid-cell grid-column="1" class="shortcut-view"></vscode-data-grid-cell>
          </vscode-data-grid-row>
          <vscode-data-grid-row class="flex-view">
            <vscode-data-grid-cell grid-column="1" class="control-view"></vscode-data-grid-cell>
          </vscode-data-grid-row>
          <vscode-data-grid-row class="footer-grid">
          </vscode-data-grid-row>
        </vscode-data-grid>`;
  if (data.state !== "asleep") {
    view.innerHTML += `<div title="Auto Renew"
                            data-vid="${data.id_s}"
                            class="auto-renew"
                            onclick='toggleAutoRenew(event)'>
                         <span class="material-symbols-outlined">
                           sync_disabled
                         </span>
                       </div>`;
  }
}

function buildContent(view, data) {
  var infoView = view.querySelector(".info-view");
  buildBasicInfo(infoView, data);

  var shortcutView = view.querySelector(".shortcut-view");
  buildShortcutView(shortcutView, data);

  var controlView = view.querySelector(".control-view");
  buildControlPanels(controlView, data);

  var footerView = view.querySelector(".footer-grid");
  buildFooter(footerView, data);
}

window.addEventListener("message", (event) => {
  const message = event.data;
  switch (message.command) {
    case "vehicle": {
      var view = document.getElementById(message.data.id_s);
      buildFramework(view, message.data);
      buildContent(view, message.data);
      break;
    }
    case "update": {
      var view = document.getElementById(message.data.id_s);
      buildContent(view, message.data);
      break;
    }
  }
});
