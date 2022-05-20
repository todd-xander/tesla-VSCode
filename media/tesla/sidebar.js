function makeURL(path) {
  return `https://file%2B.vscode-resource.vscode-cdn.net${path.join("/")}`;
}

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
  if (!view.onclick) {
    view.onclick = toggleAutoRenew;
  }
  if (poll[vid]) {
    if (!view.classList.contains("enable")) {
      view.classList.add("enable");
    }
    view.innerHTML = `<span class="material-symbols-rounded syncBtn">sync</span>
                      <span class='timestamp'>
                        ${timestr}
                      </span>`;
  } else {
    if (view.classList.contains("enable")) {
      view.classList.remove("enable");
    }
    view.innerHTML = `<span class="material-symbols-rounded syncBtn">sync_disabled</span>
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

let maps = {};

function makePushpin(map, v) {
  let lat = v.drive_state.corrected_latitude;
  let lng = v.drive_state.corrected_longitude;
  var pin = new Microsoft.Maps.Pushpin(new Microsoft.Maps.Location(lat, lng), {
    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 48 48" fill="none" style="transform: rotate(${v.drive_state.heading}deg);">
            <path d="M24.5 4L9 44L24.5 34.9091L40 44L24.5 4Z" fill="#2F88FF" stroke="black" stroke-width="4" stroke-linejoin="round"/>
          </svg>`,
    anchor: new Microsoft.Maps.Point(12, 12),
    enableHoverStyle: true,
  });
  map.entities.push(pin);
}

function buildMap(node, v) {
  clearMaps(v.id_s);
  var map = new Microsoft.Maps.Map(node, {
    credentials:
      "An_6ByRH6GN7uClufsDPzCH1A4rWipnVD2xgUYbYQPQo30fnm5zm3a1IW7mehszk",
    center: new Microsoft.Maps.Location(
      v.drive_state.corrected_latitude,
      v.drive_state.corrected_longitude
    ),
    zoom: 16,
    showDashboard: false,
    showLocateMeButton: false,
    showMapTypeSelector: false,
    showZoomButtons: false,
  });

  makePushpin(map, v);

  maps[v.id_s] = map;
}

function updateMap(map, v) {
  map.entities.clear();
  map.setOptions({
    center: new Microsoft.Maps.Location(
      v.drive_state.corrected_latitude,
      v.drive_state.corrected_longitude
    ),
  });
  map.setView({
    center: new Microsoft.Maps.Location(
      v.drive_state.corrected_latitude,
      v.drive_state.corrected_longitude
    ),
  });
  makePushpin(map, v);
}

function clearMaps(id) {
  for (var i in maps) {
    if (!id || id === i) {
      var m = maps[i];
      if (m) {
        m.dispose();
      }
      maps[i] = undefined;
    }
  }
}

function buildBasicInfo(infoView, vv) {
  let drive = "";
  if (vv.state !== "asleep") {
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
  <h1 class='banner' title='Vehile ID: ${vv.id_s}'>${vv.display_name}</h1>
  ${drive}
  <img class='car-img' src='${vv.image}'/>`;

  if (vv.state == "asleep") {
    clearMaps(vv.id_s);
    infoView.innerHTML = `
    ${basicInfo}
    <vscode-button title='Wakeup ${vv.display_name}' data-command='wakeup' class='big' data-vid='${vv.id_s}'>Wakeup</vscode-button>
    `;
    return;
  }

  let batteryIcon = "";
  let charging_state = vv.charge_state.charging_state;
  if (charging_state == "Charging") {
    batteryIcon = "battery_charging_full";
  } else if (vv.charge_state.battery_level == 100) {
    batteryIcon = "battery_full";
  } else if (vv.charge_state.battery_level < 10) {
    batteryIcon = "battery_alert";
  } else {
    let lvl = Math.floor((vv.charge_state.battery_level + 5) / 15);
    batteryIcon = `battery_${lvl}_bar`;
  }

  var battery_level = vv.charge_state.battery_level;
  var charge_limit = vv.charge_state.charge_limit_soc;
  let charging_lable = "";
  let charge_style = "style='color:var(--progress-background);'";
  if (charging_state == "Charging") {
    charging_lable = `Charging ${battery_level}%/${charge_limit}%`;
  } else if (charging_state == "Complete") {
    charging_lable = `Charging Complete`;
  } else if (charging_state == "Stopped") {
    charging_lable = `Charging Stopped`;
  } else if (charging_state == "Disconnected") {
    charging_lable = `Charger Disconnected`;
    charge_style = "";
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
      <span title="${charging_lable}">
        <span class="material-symbols-rounded" ${charge_style}>${batteryIcon}</span>
        ${battery_level}%
      </span>
      <span title="Battery Range: ${range}">
        <span class="material-symbols-rounded">speed</span>
        ${range}
      </span>
      <span title="Interior Temperature: ${temp}">
        <span class="material-symbols-rounded">device_thermostat</span>
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
    "<vscode-button class='shortcut' title='Doors: Unlocked'><span class='material-symbols-rounded'>lock_open</span></vscode-button>";
  if (vv.vehicle_state.locked) {
    lockBtn =
      "<vscode-button class='shortcut' appearance='secondary' title='Doors: Locked'><span class='material-symbols-rounded'>lock</span></vscode-button>";
  }

  let startupBtn =
    "<vscode-button class='shortcut' appearance='secondary' title='Remote Startup: Off'><span class='material-symbols-rounded'>power_settings_new</span></vscode-button>";
  if (vv.vehicle_state.remote_start) {
    startupBtn =
      "<vscode-button class='shortcut' title='Remote Startup: On'><span class='material-symbols-rounded'>power_settings_new</span></vscode-button>";
  }

  let climateBtn =
    "<vscode-button class='shortcut' appearance='secondary' title='Fan Mode: Off'><span class='material-symbols-rounded'>mode_fan_off</span></vscode-button>";
  if (vv.climate_state.is_climate_on) {
    climateBtn =
      "<vscode-button class='shortcut' title='Fan Mode: On'><span class='material-symbols-rounded'>mode_fan</span></vscode-button>";
  }

  let hornBtn =
    "<vscode-button class='shortcut' appearance='secondary' title='Honk'><span class='material-symbols-rounded'>volume_up</span></vscode-button>";
  let falshBtn =
    "<vscode-button class='shortcut' appearance='secondary' title='Flash'><span class='material-symbols-rounded'>flare</span></vscode-button>";
  let defrost =
    "<vscode-button class='shortcut' appearance='secondary' title='Defrost Mode: Off'><span class='material-symbols-rounded'>astrophotography_off</span></vscode-button>";
  if (vv.climate_state.defrost_mode !== 0) {
    defrost =
      "<vscode-button class='shortcut' title='Defrost Mode: On'><span class='material-symbols-rounded'>auto_awesome</span></vscode-button>";
  }

  let frunk =
    "<vscode-button class='shortcut' appearance='secondary' title='Frunk: Closed'><span class='material-symbols-rounded'>google_travel_outline</span></vscode-button>";
  if (vv.vehicle_state.ft !== 0) {
    frunk =
      "<vscode-button class='shortcut' title='Frunk: Opened'><span class='material-symbols-rounded'>google_travel_outline</span></vscode-button>";
  }
  let trunk =
    "<vscode-button class='shortcut' appearance='secondary' title='Trunk: Closed'><span class='material-symbols-rounded'>luggage</span></vscode-button>";
  if (vv.vehicle_state.rt !== 0) {
    trunk =
      "<vscode-button class='shortcut' title='Trunk: Opened'><span class='material-symbols-rounded'>luggage</span></vscode-button>";
  }
  let speedLimit =
    "<vscode-button class='shortcut' appearance='secondary' title='Speed Limit: Off'><span class='material-symbols-rounded'>do_not_disturb_off</span></vscode-button>";
  if (vv.vehicle_state.speed_limit_mode.active) {
    speedLimit =
      "<vscode-button class='shortcut' title='Speed Limit: On'><span class='material-symbols-rounded'>do_not_disturb</span></vscode-button>";
  }
  let valet =
    "<vscode-button class='shortcut' appearance='secondary' title='Valet Mode: Off'><span class='material-symbols-rounded'>group_off</span></vscode-button>";
  if (vv.vehicle_state.valet_mode) {
    valet =
      "<vscode-button class='shortcut' title='Valet Mode: On'><span class='material-symbols-rounded'>group</span></vscode-button>";
  }
  let sentry =
    "<vscode-button class='shortcut' appearance='secondary' title='Sentry Mode: Off'><span class='material-symbols-rounded'>remove_moderator</span></vscode-button>";
  if (vv.vehicle_state.sentry_mode) {
    sentry =
      "<vscode-button class='shortcut' title='Sentry Mode: On'><span class='material-symbols-rounded'>shield</span></vscode-button>";
  }

  shortcutView.innerHTML = `
        <vscode-divider></vscode-divider>
        <div class='shortcuts'>
          ${lockBtn}
          ${startupBtn}
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
    clearMaps(vv.id_s);
    return;
  }

  var viewLocation = controlView.querySelector(".control-view-location");
  var viewAction = controlView.querySelector(".control-view-action");
  var viewClimate = controlView.querySelector(".control-view-climate");
  var viewCharge = controlView.querySelector(".control-view-charge");
  var viewSecurity = controlView.querySelector(".control-view-security");

  var bingMap = maps[vv.id_s];
  if (
    bingMap &&
    (vv.drive_state.shift_state === "D" || vv.drive_state.shift_state === "R")
  ) {
    updateMap(bingMap, vv);
  } else if (!bingMap) {
    viewLocation.innerHTML = "";
    let mapDom = viewLocation.querySelector(`#map-${vv.id_s}`);
    if (!mapDom) {
      let content = document.createElement("div");
      content.id = `map-box-${vv.id_s}`;

      let map = document.createElement("div");
      map.classList.add("map");
      map.id = `map-${vv.id_s}`;
      content.appendChild(map);

      let shortcuts = document.createElement("div");
      shortcuts.classList.add("shortcuts");
      shortcuts.innerHTML = `
          <vscode-button class="shortcut" appearance="secondary" title="Location" current-value=""><span class="material-symbols-rounded">pin_drop</span><span class="label">Location</span></vscode-button>
          <vscode-button class="shortcut" appearance="secondary" title="Navigation" current-value=""><span class="material-symbols-rounded">navigation</span><span class="label">Navigation</span></vscode-button>
          <vscode-button class="shortcut" appearance="secondary" title="EV Station" current-value=""><span class="material-symbols-rounded">ev_station</span><span class="label">EV Station</span></vscode-button>
          <vscode-button class="shortcut" appearance="secondary" title="Monitoring" current-value=""><span class="material-symbols-rounded">monitoring</span><span class="label">Monitoring</span></vscode-button>
      `;
      content.appendChild(shortcuts);

      viewLocation.appendChild(content);
      mapDom = viewLocation.querySelector(`#map-${vv.id_s}`);
    }
    buildMap(mapDom, vv);
  }

  var sunroof = vv.vehicle_config.sun_roof_installed;
  var p_fl = vv.vehicle_state.tpms_pressure_fl;
  var p_fr = vv.vehicle_state.tpms_pressure_fr;
  var p_rl = vv.vehicle_state.tpms_pressure_rl;
  var p_rr = vv.vehicle_state.tpms_pressure_rr;
  viewAction.innerHTML = `<div>
    <center class="model">
      <div class="above-view-model" style="--vehicle-image: url(${makeURL([
        vv.baseUrl,
        "media",
        "Tesla-Model-3.svg",
      ])})">
        <vscode-button class="action-btn" appearance="icon" title="Open Frunk"><span class="material-symbols-rounded">google_travel_outline</span></vscode-button>
        <vscode-button class="action-btn" appearance="icon" title="Open Sunroof" 
            style="${sunroof ? "" : "visibility: hidden;"}"
        >
          <span class="material-symbols-rounded">sensor_window</span>
        </vscode-button>
        <vscode-button class="action-btn last" appearance="icon" title="Open Frunk"><span class="material-symbols-rounded">luggage</span></vscode-button>
        <vscode-button class="action-btn charger" appearance="icon"><span class="material-symbols-rounded">settings_input_svideo</span></vscode-button>
        <div class="tpms_pressure"
             style="${p_fl || p_fr || p_rl || p_rr || "display:none;"}"
        >
          <div class='fl'>${p_fl ? p_fl.toFixed(1) : "--"} bar</div>
          <div class='fr'>${p_fr ? p_fr.toFixed(1) : "--"} bar</div>
          <div class='rl'>${p_rl ? p_rl.toFixed(1) : "--"} bar</div>
          <div class='rr'>${p_rr ? p_rr.toFixed(1) : "--"} bar</div>
        </div>
      </div>
      <div class="shortcuts">
        <vscode-button class='shortcut' appearance='secondary' title='Unlock'><span class='material-symbols-rounded'>lock</span><span class="label">Unlock</span></vscode-button>
        <vscode-button class='shortcut' appearance='secondary' title='Start'><span class="material-symbols-rounded">power_settings_new</span><span class="label">Start</span></vscode-button>
        <vscode-button class='shortcut' appearance='secondary' title='Honk'><span class='material-symbols-rounded'>volume_up</span><span class="label">Honk</span></vscode-button>
        <vscode-button class='shortcut' appearance='secondary' title='Flash'><span class='material-symbols-rounded'>flare</span><span class="label">Flash</span></vscode-button>
      </div>
    </center>
    </div>`;

  let climate = vv.climate_state;
  let in_temp = `${Math.floor(climate.inside_temp + 0.5)}°C`;
  let out_temp = `${Math.floor(climate.outside_temp + 0.5)}°C`;
  let dr_tmp = `${Math.floor(climate.driver_temp_setting + 0.5)}°C`;
  let pg_tmp = `${Math.floor(climate.passenger_temp_setting + 0.5)}°C`;
  if (vv.gui_settings.gui_temperature_units === "F") {
    in_temp = `${Math.floor(climate.inside_temp * 1.8 + 32.5)}°F`;
    out_temp = `${Math.floor(climate.outside_temp * 1.8 + 32.5)}°F`;
    dr_tmp = `${Math.floor(climate.driver_temp_setting * 1.8 + 32.5)}°F`;
    pg_tmp = `${Math.floor(climate.passenger_temp_setting * 1.8 + 32.5)}°F`;
  }
  let steer_pos = 'style="position: absolute; margin-left: -50px;"';
  let heater_pos = 'style="position: absolute; margin: 6px auto auto 60px;"';
  if (vv.driverPosition == "RightHand") {
    steer_pos = 'style="position: absolute; margin-left: 10px;"';
    heater_pos = 'style="position: absolute; margin: 6px auto auto 120px;"';
  }
  viewClimate.innerHTML = `
  <div>
    <center class="model scaled">
      <div class="above-view-model"
           style="--vehicle-image: url(${makeURL([
             vv.baseUrl,
             "media",
             "Tesla-Model-3.svg",
           ])})">
        <span class="material-symbols-rounded steering" ${steer_pos}>donut_large</span>
        <vscode-button class="action-btn" appearance="icon" ${heater_pos}>
          <span class="material-symbols-rounded" style="transform:rotate(90deg);">airware</span>
        </vscode-button>
        <vscode-button class="action-btn" appearance="icon" style="position: absolute; margin: 60px auto auto 60px;">
          <span class="material-symbols-rounded" style="transform:rotate(90deg);">airware</span>
        </vscode-button>
        <vscode-button class="action-btn" appearance="icon" style="position: absolute; margin: 60px auto auto 120px;">
          <span class="material-symbols-rounded" style="transform:rotate(90deg);">airware</span>
        </vscode-button>
        <vscode-button class="action-btn" appearance="icon" style="position: absolute; margin: 180px auto auto 60px;">
          <span class="material-symbols-rounded" style="transform:rotate(90deg);">airware</span>
        </vscode-button>
        <vscode-button class="action-btn" appearance="icon" style="position: absolute; margin: 180px auto auto 90px;">
          <span class="material-symbols-rounded" style="transform:rotate(90deg);">airware</span>
        </vscode-button>
        <vscode-button class="action-btn" appearance="icon" style="position: absolute; margin: 180px auto auto 120px;">
          <span class="material-symbols-rounded" style="transform:rotate(90deg);">airware</span>
        </vscode-button>
      </div>
    </center>
    <div class="io_temp">Interior ${in_temp} · ${out_temp} Exterior</div>
    <div class="temp_control">
      <vscode-button appearance="icon" class="left"><span class='material-symbols-rounded'>arrow_left</span></vscode-button>
      <vscode-tag>${dr_tmp}</vscode-tag>
      <vscode-button appearance="icon" class="right"><span class="material-symbols-rounded">arrow_right</span></vscode-button>
      <vscode-button appearance="icon" class="left"><span class='material-symbols-rounded'>arrow_left</span></vscode-button>
      <vscode-tag>${pg_tmp}</vscode-tag>
      <vscode-button appearance="icon" class="right"><span class="material-symbols-rounded">arrow_right</span></vscode-button>
    </div>
    <div class="shortcuts">
      <vscode-button class="shortcut" appearance="secondary" title="A/C" current-value=""><span class="material-symbols-rounded">mode_fan</span><span class="label">A/C</span></vscode-button>
      <vscode-button class="shortcut" appearance="secondary" title="Defrost" current-value=""><span class="material-symbols-rounded">auto_awesome</span><span class="label">Defrost</span></vscode-button>
      <vscode-button class="shortcut" appearance="secondary" title="Vent" current-value=""><span class="material-symbols-rounded">sim_card_download</span><span class="label">Vent</span></vscode-button>
      <vscode-button class="shortcut" appearance="secondary" title="OverHeat Protection" current-value=""><span class="material-symbols-rounded">gpp_maybe</span><span class="label">Overheat</span></vscode-button>
    </div>
  </div>`;

  var charging_state = vv.charge_state.charging_state;
  var current = vv.charge_state.charger_actual_current;
  var max_current = vv.charge_state.charge_current_request_max;
  var voltage = vv.charge_state.charger_voltage;
  var power = vv.charge_state.charger_power;
  var battery_level = vv.charge_state.battery_level;
  var charge_limit = vv.charge_state.charge_limit_soc;
  var added_rated = vv.charge_state.charge_miles_added_rated;
  var charge_rate = vv.charge_state.charge_rate;
  var distance_unit = "mi";
  var minutes_to_full_charge = vv.charge_state.minutes_to_full_charge;
  var time_str = `${minutes_to_full_charge}min`;
  if (vv.gui_settings.gui_distance_units === "km/hr") {
    added_rated = Math.floor(added_rated * 1.609344 + 0.5);
    charge_rate = Math.floor(charge_rate * 1.609344 + 0.5);
    distance_unit = "km";
  }
  if (minutes_to_full_charge >= 60) {
    time_str =
      `${Match.floor(minutes_to_full_charge / 60)}hr` +
      ` ${Match.floor(minutes_to_full_charge % 60)}min`;
  }
  var progressInfo = `<span class="material-symbols-rounded charger ${charging_state}" title="${charging_state}">charger</span>
                      <div class="charge-progress">
                        <div class='meter ${charging_state}' style='width: ${battery_level}%' data-value="${battery_level}"></div>
                      </div>
                      <input type='range' value="${charge_limit}" min="0" max="100" class="charge-limit-set"></input>
                      <output class='battery-limit-label'>${charge_limit}%</output>`;
  var stateInfo = `<div class="charge-info" style="visibility: hidden;"></div>`;
  if (charging_state === "Charging") {
    stateInfo = `<div class="charge-info">~${time_str} · ${current}/${max_current}A · ${voltage}V · ${power}kW</div>`;
  }

  viewCharge.innerHTML = `
  <div>
    <div class='charge-state'>
      ${progressInfo}
      ${stateInfo}
    </div>
  </div>`;

  let sentry = `<span class='material-symbols-rounded'>shield</span><span class='label'>Sentrey Mode</span>`;
  if (vv.vehicle_state.sentry_mode) {
    sentry += `<span class='material-symbols-rounded toggle enable'>toggle_on</span>`;
  } else {
    sentry += `<span class='material-symbols-rounded toggle'>toggle_off</span>`;
  }

  let valet = `<span class='material-symbols-rounded'>group</span><span class='label'>Valet Mode</span>`;
  if (vv.vehicle_state.valet_mode) {
    valet += `<span class='material-symbols-rounded toggle enable'>toggle_on</span>`;
  } else {
    valet += `<span class='material-symbols-rounded toggle'>toggle_off</span>`;
  }

  let speedLimit = `<span class='material-symbols-rounded'>speed</span><span class='label'>Speed Limit Mode</span>`;
  if (vv.vehicle_state.speed_limit_mode.active) {
    speedLimit += `<span class='material-symbols-rounded toggle enable'>toggle_on</span>`;
  } else {
    speedLimit += `<span class='material-symbols-rounded toggle'>toggle_off</span>`;
  }

  let notifications = `<span class='material-symbols-rounded'>notifications</span><span class='label'>Notifications</span>`;
  viewSecurity.innerHTML = `
    <div>
      <vscode-divider></vscode-divider>
      <div class='switcher'>${sentry}</div>
      <vscode-divider></vscode-divider>
      <div class='switcher'>${valet}</div>
      <vscode-divider></vscode-divider>
      <div class='switcher'>${speedLimit}</div>
      <vscode-divider></vscode-divider>
      <div class='switcher'>${notifications}</div>
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
  clearMaps();
  view.innerHTML = `
        <div title="Auto Renew"
          data-vid="${data.id_s}"
          class="auto-renew">
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
                <vscode-panel-tab title='Location'><span class="material-symbols-rounded">map</span><span class='view-label'>Location</span></vscode-panel-tab>
                <vscode-panel-tab title='Aaction'><span class="material-symbols-rounded">directions_car</span><span class='view-label'>Aaction</span></vscode-panel-tab>
                <vscode-panel-tab title='Climate'><span class="material-symbols-rounded">ac_unit</span><span class='view-label'>Climate</span></vscode-panel-tab>
                <vscode-panel-tab title='Charge'><span class="material-symbols-rounded">electrical_services</span><span class='view-label'>Charge</span></vscode-panel-tab>
                <vscode-panel-tab title='Security'><span class="material-symbols-rounded">security</span><span class='view-label'>Security</span></vscode-panel-tab>
                <vscode-panel-view class='control-view-content control-view-location'></vscode-panel-view>
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
  if (!view) {
    return;
  }
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

function login(ev) {
  var account = document.getElementById("email");
  vscode.postMessage({ command: "login", email: account.value });
}
function reset(event) {
  var account = document.getElementById("email");
  var tip = document.getElementById("tip");
  var url_tip = document.getElementById("login-url");
  var url = document.getElementById("url");
  var reset_btn = document.getElementById("reset");
  var verify_btn = document.getElementById("verify");
  account.value = "";
  account.disabled = false;
  url.value = "";
  url.disabled = true;
  url.dataset.verifier = undefined;
  tip.classList.add("disabled");
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
  vscode.postMessage({
    command: "verify",
    url: url.value,
    verifier: url.dataset.verifier,
  });
}

window.addEventListener("message", (event) => {
  const message = event.data;
  switch (message.command) {
    case "login": {
      clearMaps();
      document.body.innerHTML = `
      <body>
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
        <div style='margin: 0 auto; padding-top: 50px; max-width: 260px;'>
          <img id='logo' src='${makeURL([message.logo])}'>
          <vscode-text-field type="email" id="email" name="email" placeholder="Tesla Account Email" onchange='login(event)'>1. Input account email</vscode-text-field>
          <div id='tip' class='disabled'>
          2. Login from 
          <a id='login-url'>
            <img src='${makeURL([message.logo])}'>
          </a>
          </div>
          <vscode-text-field type="url" id="url" name="url" placeholder="Tesla Verification URL" oninput='urlcheck(event)' disabled>3. Paste returned URL</vscode-text-field>
          <vscode-button title='Reset' appearance="secondary" id='reset' onclick='reset(event)' disabled>Reset</vscode-button>
          <vscode-button title='Verify Account' id='verify' onclick='verify(event)' disabled>Login</vscode-button>
        </div>`;
      break;
    }
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
      tip.classList.remove("disabled");
      reset_btn.disabled = false;
      break;
    }
    case "froze": {
      clearMaps();
      document.body.innerHTML = `
      <div style='height:100vh; padding: 0 8px'>
        <div>
          <img src='${makeURL([message.logo])}'
               style='width: 100px; margin: 0 auto 50px auto; padding-top: 100px; display: flex; filter: contrast(0.1);'>
        </div>
        <vscode-button title='Unfreeze' data-command='unfreeze' class='big'>Unfreeze</vscode-button>
      </div>`;
      break;
    }
    case "vehicleList": {
      let data = message.data;
      let vehicleTab = "";
      let vehicleView = "";
      for (let idx = 0; idx < data.length; idx++) {
        let v = data[idx];
        vehicleTab += `<vscode-panel-tab>${v.display_name}</vscode-panel-tab>`;
        vehicleView += `<vscode-panel-view id='${v.id_s}' class='container'>
                        </vscode-panel-view>`;
      }
      let panels = `<vscode-panels class='main'>
                      ${data.length > 1 ? vehicleTab : ""}${vehicleView}
                    </vscode-panels>`;
      document.body.innerHTML = panels;
      break;
    }
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

window.addEventListener("load", (event) => {
  vscode.postMessage({ command: "loaded" });
});
