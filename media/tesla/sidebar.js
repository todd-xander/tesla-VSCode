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

function buildSyncBtn(view, vid, ts) {
  let timestr = new Date(ts).toLocaleString();
  view.title = `Last update: ${timestr}`;
  if (poll[vid]) {
    if (!view.classList.contains("enable")) {
      view.classList.add("enable");
    }
    view.innerHTML = `<span class="material-symbols-outlined syncBtn">sync</span>
                      <span class='timestamp'>
                        ${timestr}
                      </span>`;
  } else {
    if (view.classList.contains("enable")) {
      view.classList.remove("enable");
    }
    view.innerHTML = `<span class="material-symbols-outlined syncBtn">sync_disabled</span>
                        <span class='timestamp'>
                          ${timestr}
                        </span>`;
  }
}

function toggleAutoRenew(ev) {
  let vid = ev.currentTarget.dataset.vid;
  ev.currentTarget.classList.toggle("enable");
  let polling = ev.currentTarget.classList.contains("enable");

  if (polling) {
    startPollingVehicleState(vid, 5000);
  } else {
    stopPollingVehicleState(vid);
  }

  buildSyncBtn(ev.currentTarget, vid, Date.now());
}

function buildBasicInfo(infoView, vv) {
  let loc = "";
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
            <span class="material-symbols-outlined" style="transform: rotate(${vv.drive_state.heading}deg);">assistant_navigation</span>
          </a>`;
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
  <h1 class='banner' title='Vehile ID: ${vv.id_s}'>${vv.display_name}${loc}</h1>
  ${drive}
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
    "<vscode-button class='shortcut' title='Doors: Unlocked'><span class='material-symbols-outlined'>lock_open</span></vscode-button>";
  if (vv.vehicle_state.locked) {
    lockBtn =
      "<vscode-button class='shortcut' appearance='secondary' title='Doors: Locked'><span class='material-symbols-outlined'>lock</span></vscode-button>";
  }

  let startupBtn =
    "<vscode-button class='shortcut' appearance='secondary' title='Remote Startup: Off'><span class='material-symbols-outlined'>key_off</span></vscode-button>";
  if (vv.vehicle_state.remote_start) {
    startupBtn =
      "<vscode-button class='shortcut' title='Remote Startup: On'><span class='material-symbols-outlined'>key</span></vscode-button>";
  }

  let climateBtn =
    "<vscode-button class='shortcut' appearance='secondary' title='Fan Mode: Off'><span class='material-symbols-outlined'>mode_fan_off</span></vscode-button>";
  if (vv.climate_state.is_climate_on) {
    climateBtn =
      "<vscode-button class='shortcut' title='Fan Mode: On'><span class='material-symbols-outlined'>mode_fan</span></vscode-button>";
  }

  let chargeBtn =
    "<vscode-button class='shortcut' appearance='secondary' title='Charging: Disconnected'><span class='material-symbols-outlined'>power</span></vscode-button>";
  if (
    vv.charge_state.charge_port_door_open &&
    vv.charge_state.charge_port_latch === "Engaged"
  ) {
    var current = vv.charge_state.charger_actual_current;
    var voltage = vv.charge_state.charger_voltage;
    var power = vv.charge_state.charger_power;
    var battery_level = vv.charge_state.battery_level;
    var charge_limit = vv.charge_state.charge_limit_soc;
    var added_rated = vv.charge_state.charge_miles_added_rated;
    var charge_rate = vv.charge_state.charge_rate;
    var distance_unit = "mi";
    var minutes_to_full_charge = vv.charge_state.minutes_to_full_charge;
    if (vv.gui_settings.gui_distance_units === "km/hr") {
      added_rated = Math.floor(added_rated * 1.609344 + 0.5);
      charge_rate = Math.floor(charge_rate * 1.609344 + 0.5);
      distance_unit = "km";
    }
    var title = `${battery_level}%/${charge_limit}%`;
    if (vv.charge_state.charging_state === "Stopped") {
      chargeBtn = `<vscode-button class='shortcut' title='Chaging: Stopped ${title}'><span class='material-symbols-outlined'>power</span></vscode-button>`;
    } else if (vv.charge_state.charging_state === "Complete") {
      title += ` +${added_rated}${distance_unit}`;
      chargeBtn = `<vscode-button class='shortcut' title='Charging: Complete ${title}'><span class='material-symbols-outlined'>bolt</span></vscode-button>`;
    } else {
      title += ` +${added_rated}${distance_unit} ${charge_rate}${distance_unit}/hr ${current}A/${voltage}V ${power}kwh ${minutes_to_full_charge}minutes remained`;
      chargeBtn = `<vscode-button class='shortcut charging' title='Charging: ${title}'><span class='material-symbols-outlined'>bolt</span></vscode-button>`;
    }
  }

  let hornBtn =
    "<vscode-button class='shortcut' appearance='secondary' title='Honk Horn'><span class='material-symbols-outlined'>volume_up</span></vscode-button>";
  let falshBtn =
    "<vscode-button class='shortcut' appearance='secondary' title='Flash Headlights'><span class='material-symbols-outlined'>flare</span></vscode-button>";
  let defrost =
    "<vscode-button class='shortcut' appearance='secondary' title='Defrost Mode: Off'><span class='material-symbols-outlined'>astrophotography_off</span></vscode-button>";
  if (vv.climate_state.defrost_mode !== 0) {
    defrost =
      "<vscode-button class='shortcut' title='Defrost Mode: On'><span class='material-symbols-outlined'>auto_awesome</span></vscode-button>";
  }

  let frunk =
    "<vscode-button class='shortcut' appearance='secondary' title='Frunk: Closed'><span class='material-symbols-outlined'>google_travel_outline</span></vscode-button>";
  if (vv.vehicle_state.ft !== 0) {
    frunk =
      "<vscode-button class='shortcut' title='Frunk: Opened'><span class='material-symbols-outlined'>google_travel_outline</span></vscode-button>";
  }
  let trunk =
    "<vscode-button class='shortcut' appearance='secondary' title='Trunk: Closed'><span class='material-symbols-outlined'>luggage</span></vscode-button>";
  if (vv.vehicle_state.rt !== 0) {
    trunk =
      "<vscode-button class='shortcut' title='Trunk: Opened'><span class='material-symbols-outlined'>luggage</span></vscode-button>";
  }
  let speedLimit =
    "<vscode-button class='shortcut' appearance='secondary' title='Speed Limit: Off'><span class='material-symbols-outlined'>do_not_disturb_off</span></vscode-button>";
  if (vv.vehicle_state.speed_limit_mode.active) {
    speedLimit =
      "<vscode-button class='shortcut' title='Speed Limit: On'><span class='material-symbols-outlined'>do_not_disturb</span></vscode-button>";
  }
  let valet =
    "<vscode-button class='shortcut' appearance='secondary' title='Valet Mode: Off'><span class='material-symbols-outlined'>group_off</span></vscode-button>";
  if (vv.vehicle_state.valet_mode) {
    valet =
      "<vscode-button class='shortcut' title='Valet Mode: On'><span class='material-symbols-outlined'>group</span></vscode-button>";
  }
  let sentry =
    "<vscode-button class='shortcut' appearance='secondary' title='Sentry Mode: Off'><span class='material-symbols-outlined'>remove_moderator</span></vscode-button>";
  if (vv.vehicle_state.sentry_mode) {
    sentry =
      "<vscode-button class='shortcut' title='Sentry Mode: On'><span class='material-symbols-outlined'>shield</span></vscode-button>";
  }

  shortcutView.innerHTML = `
        <vscode-divider></vscode-divider>
        <div class='shortcuts'>
          ${lockBtn}
          ${chargeBtn}
          ${frunk}
          ${trunk}
          ${climateBtn}
          ${defrost}
          ${valet}
          ${sentry}
        </div>
        <vscode-divider></vscode-divider>
        `;
}

function buildControlPanels(controlView, vv) {
  if (vv.state == "asleep") {
    return;
  }

  var viewAction = controlView.querySelector(".control-view-action");
  var viewClimate = controlView.querySelector(".control-view-climate");
  var viewCharge = controlView.querySelector(".control-view-charge");
  var viewSecurity = controlView.querySelector(".control-view-security");

  viewAction.innerHTML = `<div style='width:100%'>
    <center class="model">
      <div class="above-view-model">
        <vscode-button class="action-btn">FRUNK</vscode-button>
        <vscode-button class="action-btn">SUNROOF</vscode-button>
        <vscode-button class="action-btn last">TRUNK</vscode-button>
        <vscode-button class="action-btn charger"><span class="material-symbols-outlined" style="font-size: 1.3em">settings_input_svideo</span></vscode-button>
        <div class="model-bg" style="margin-top: -375px; background-image: url(https://file%2B.vscode-resource.vscode-cdn.net${vv.baseUrl}/media/Tesla-Model-3.svg)"></div>
      </div>
      <div class="shortcuts">
        <vscode-button class='shortcut' appearance='secondary' title='Lock Doors'><span class='material-symbols-outlined'>lock</span></vscode-button>
        <vscode-button class='shortcut' appearance='secondary' title='Honk Horn'><span class='material-symbols-outlined'>volume_up</span></vscode-button>
        <vscode-button class='shortcut' appearance='secondary' title='Flash Headlights'><span class='material-symbols-outlined'>flare</span></vscode-button>
        <vscode-button class='shortcut' appearance='secondary' title='Ventilate'><span class="material-symbols-outlined">sim_card_download</span></vscode-button>
      </div>
    </center>
    </div>`;

  viewClimate.innerHTML = `<div style='width:100%'>
    <center class="model scaled">
      <div class="above-view-model ${vv.driverPosition}">
        <span class="material-symbols-outlined steering">donut_large</span>
        <div class="model-bg" style="background-image: url(https://file%2B.vscode-resource.vscode-cdn.net${vv.baseUrl}/media/Tesla-Model-3.svg)"></div>
      </div>
    </center>
    </div>`;

  var current = vv.charge_state.charger_actual_current;
  var voltage = vv.charge_state.charger_voltage;
  var power = vv.charge_state.charger_power;
  var battery_level = vv.charge_state.battery_level;
  var charge_limit = vv.charge_state.charge_limit_soc;
  var added_rated = vv.charge_state.charge_miles_added_rated;
  var charge_rate = vv.charge_state.charge_rate;
  var distance_unit = "mi";
  var minutes_to_full_charge = vv.charge_state.minutes_to_full_charge;
  if (vv.gui_settings.gui_distance_units === "km/hr") {
    added_rated = Math.floor(added_rated * 1.609344 + 0.5);
    charge_rate = Math.floor(charge_rate * 1.609344 + 0.5);
    distance_unit = "km";
  }
  var progressInfo = `<div value="${battery_level}" max="100" class="charge-progress">
                        <div class='meter ${vv.charge_state.charging_state}' style='width: ${battery_level}%' data-value="${battery_level}"></div>
                      </div>
                      <input type='range' value="${charge_limit}" min="0" max="100" class="charge-limit-set"></input>
                      <output class='battery-limit-label'>${charge_limit}%</output>`;
  var stateInfo = "";
  if (
    vv.charge_state.charge_port_door_open &&
    vv.charge_state.charge_port_latch === "Engaged"
  ) {
    if (vv.charge_state.charging_state === "Stopped") {
      stateInfo = `<div></div>`;
    } else if (vv.charge_state.charging_state === "Complete") {
      stateInfo = `<div>+${added_rated}${distance_unit}</div>`;
    } else {
      stateInfo = `<div>+${added_rated}${distance_unit} ${charge_rate}${distance_unit}/hr ${current}A/${voltage}V ${power}kwh ${minutes_to_full_charge}minutes remained</div>`;
    }
  }

  viewCharge.innerHTML = `<div style='width:100%'>
    ${progressInfo}
    ${stateInfo}
    </div>`;

  let sentry = `<span class='material-symbols-outlined'>shield</span><span class='label'>Sentrey Mode</span>`;
  if (vv.vehicle_state.sentry_mode) {
    sentry += `<span class='material-symbols-outlined toggle enable'>toggle_on</span>`;
  } else {
    sentry += `<span class='material-symbols-outlined toggle'>toggle_off</span>`;
  }

  let valet = `<span class='material-symbols-outlined'>group</span><span class='label'>Valet Mode</span>`;
  if (vv.vehicle_state.valet_mode) {
    valet += `<span class='material-symbols-outlined toggle enable'>toggle_on</span>`;
  } else {
    valet += `<span class='material-symbols-outlined toggle'>toggle_off</span>`;
  }

  let speedLimit = `<span class='material-symbols-outlined'>speed</span><span class='label'>Speed Limit Mode</span>`;
  if (vv.vehicle_state.speed_limit_mode.active) {
    speedLimit += `<span class='material-symbols-outlined toggle enable'>toggle_on</span>`;
  } else {
    speedLimit += `<span class='material-symbols-outlined toggle'>toggle_off</span>`;
  }
  viewSecurity.innerHTML = `
    <div style='width:100%'>
      <vscode-divider></vscode-divider>
      <div class='switcher'>${sentry}</div>
      <vscode-divider></vscode-divider>
      <div class='switcher'>${valet}</div>
      <vscode-divider></vscode-divider>
      <div class='switcher'>${speedLimit}</div>
      <vscode-divider></vscode-divider>
      <div class='debug' style='user-select: text; white-space: pre;'>
        ${JSON.stringify(vv, null, 2)}
      </div>
    </div>`;
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
    update = `<vscode-divider></vscode-divider>
              <h3>New Update Available: 
                <span style="white-space: nowrap;">
                  ${vv.vehicle_state.software_update.version}
                </span>
              </h3>
              <vscode-button class='big' title='Update to ${vv.vehicle_state.software_update.version}'>
                Update
              </vscode-button>`;
  } else if (vv.vehicle_state.software_update.status === "scheduled") {
    update = `<vscode-divider></vscode-divider>
              <h3>Update Scheduled: 
                <span style="white-space: nowrap;">
                  ${vv.vehicle_state.software_update.version}
                </span>
              </h3>
              <div class='update'>
                <div class="progressbar" title='Update downloading: ${vv.vehicle_state.software_update.download_perc}%'>
                  <div style="width:${vv.vehicle_state.software_update.download_perc}%"></div>
                </div>
              </div>`;
  } else if (vv.vehicle_state.software_update.status === "installing") {
    update = `<vscode-divider></vscode-divider>
              <h3>Update Installing: 
                <span style="white-space: nowrap;">
                  ${vv.vehicle_state.software_update.version}
                </span>
              </h3>
              <div class='update'>
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
      <vscode-data-grid-row>
        <vscode-data-grid-cell style="opacity: 1" grid-column="1">
          ${update}
        </vscode-data-grid-cell>
      </vscode-data-grid-row>
  `;
}

function buildFramework(view, data) {
  view.innerHTML = `
        <div title="Auto Renew"
          data-vid="${data.id_s}"
          class="auto-renew"
          onclick='toggleAutoRenew(event)'>
        </div>
        <vscode-data-grid class="view-grid" generate-header="none" aria-label="No Header">
          <vscode-data-grid-row>
            <vscode-data-grid-cell grid-column="1" class="info-view"></vscode-data-grid-cell>
          </vscode-data-grid-row>
          <vscode-data-grid-row>
            <vscode-data-grid-cell grid-column="1" class="shortcut-view"></vscode-data-grid-cell>
          </vscode-data-grid-row>
          <vscode-data-grid-row class="flex-view">
            <vscode-data-grid-cell grid-column="1" class="control-view">
              <vscode-panels>
                <vscode-panel-tab title='Aaction'><span class="material-symbols-outlined">directions_car</span><span class='view-label'>Aaction</span></vscode-panel-tab>
                <vscode-panel-tab title='Climate'><span class="material-symbols-outlined">ac_unit</span><span class='view-label'>Climate</span></vscode-panel-tab>
                <vscode-panel-tab title='Charge'><span class="material-symbols-outlined">electrical_services</span><span class='view-label'>Charge</span></vscode-panel-tab>
                <vscode-panel-tab title='Security'><span class="material-symbols-outlined">security</span><span class='view-label'>Security</span></vscode-panel-tab>
                <vscode-panel-view class='control-view-content control-view-action'></vscode-panel-view>
                <vscode-panel-view class='control-view-content control-view-climate'></vscode-panel-view>
                <vscode-panel-view class='control-view-content control-view-charge'></vscode-panel-view>
                <vscode-panel-view class='control-view-content control-view-security'></vscode-panel-view>
              </vscode-panels>
            </vscode-data-grid-cell>
          </vscode-data-grid-row>
          <vscode-data-grid-row class="footer-grid">
          </vscode-data-grid-row>
        </vscode-data-grid>`;
}

function buildContent(view, data) {
  var ts;
  if (data.state === "asleep") {
    if (!view.classList.contains("asleep")) {
      view.classList.add("asleep");
    }
    ts = Date.now();
  } else {
    if (view.classList.contains("asleep")) {
      view.classList.remove("asleep");
    }
    ts = data.vehicle_state.timestamp;
  }
  var renew = view.querySelector(".auto-renew");
  buildSyncBtn(renew, data.id_s, ts);

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
