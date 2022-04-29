window.addEventListener("message", (event) => {
  const message = event.data;
  switch (message.command) {
    case "vehicle": {
      var vv = message.data;
      var view = document.getElementById(vv.id_s);
      var devider = document.createElement("vscode-divider");
      view.innerHTML = "";

      var infoView = document.createElement("div");
      infoView.classList.add("info-view");

      let loc = "";
      if (vv.state !== "asleep") {
        loc = `<a class='locIcon' title='Location' href='https://www.google.com/maps/search/?api=1&query=${vv.drive_state.corrected_latitude},${vv.drive_state.corrected_longitude}'>
                <span class="material-symbols-outlined">explore</span>
              </a>`;
      }

      let basicInfo = `
      <h1 class='banner'>${vv.display_name}${loc}</h1>
      <div class='secondary'>
        <span class='model'>${vv.vehicle_config.car_type}</span>
        <vscode-badge class='vin'>${vv.vin}</vscode-badge>
      </div>
      <img class='car-img' src='${vv.image}'/>`;

      if (vv.state == "asleep") {
        infoView.innerHTML = `
        ${basicInfo}
        <vscode-button data-command='wakeup' style='width:100%' data-vid='${vv.id_s}'>Wakeup</vscode-button>
        `;
        view.appendChild(infoView);
        break;
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
        range = `${Math.floor(vv.charge_state.battery_range * 1.609 + 0.5)}km`;
      }

      let temp = `${vv.climate_state.inside_temp}°C`;
      if (vv.gui_settings.gui_temperature_units === "F") {
        temp = `${vv.climate_state.inside_temp * 1.8 + 32}°F`;
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
      view.appendChild(infoView);
      view.appendChild(devider.cloneNode(true));

      var shortcutView = document.createElement("div");
      shortcutView.classList.add("shortcut-view");
      let lockBtn =
        "<vscode-button class='shortcut' appearance='secondary' title='Unlocked'><span class='material-symbols-outlined'>lock_open</span></vscode-button>";
      if (vv.vehicle_state.locked) {
        lockBtn =
          "<vscode-button class='shortcut' title='Locked'><span class='material-symbols-outlined'>lock</span></vscode-button>";
      }

      let startupBtn =
        "<vscode-button class='shortcut' appearance='secondary' title='Standby'><span class='material-symbols-outlined'>car_rental</span></vscode-button>";
      if (vv.vehicle_state.remote_start) {
        startupBtn =
          "<vscode-button class='shortcut' title='Startup'><span class='material-symbols-outlined'>car_rental</span></vscode-button>";
      }

      let climateBtn =
        "<vscode-button class='shortcut' appearance='secondary' title='Climate Off'><span class='material-symbols-outlined'>mode_fan_off</span></vscode-button>";
      if (vv.climate_state.is_climate_on) {
        climateBtn =
          "<vscode-button class='shortcut' title='Climate On'><span class='material-symbols-outlined'>air</span></vscode-button>";
      }

      let chargeBtn =
        "<vscode-button class='shortcut' appearance='secondary' title='Charger Disconnected'><span class='material-symbols-outlined'>power_off</span></vscode-button>";
      if (
        vv.charge_state.charge_port_door_open &&
        vv.charge_state.charge_port_latch === "Engaged"
      ) {
        if (vv.charge_state.charging_state === "Stopped") {
          chargeBtn =
            "<vscode-button class='shortcut' appearance='secondary' title='Charge Stopped'><span class='material-symbols-outlined'>bolt</span></vscode-button>";
        } else if (vv.charge_state.charging_state === "Complete") {
          chargeBtn =
            "<vscode-button class='shortcut' title='Charge Complete'><span class='material-symbols-outlined'>bolt</span></vscode-button>";
        } else {
          chargeBtn =
            "<vscode-button class='shortcut charging' title='Charging'><span class='material-symbols-outlined'>bolt</span></vscode-button>";
        }
      }

      shortcutView.innerHTML = `
        <div class='shortcuts'>
          ${lockBtn}
          ${startupBtn}
          ${climateBtn}
          ${chargeBtn}
        </div>
        `;
      view.appendChild(shortcutView);
      view.appendChild(devider.cloneNode(true));

      var controlView = document.createElement("div");
      controlView.classList.add("control-view");

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
        <vscode-panel-view><div id='json-response' style='height: calc(100vh - 450px); overflow: scroll;'></div></vscode-panel-view>
        </vscode-panels>
      `;

      view.appendChild(controlView);
      view.appendChild(devider);

      var detail = controlView.querySelector("#json-response");
      detail.innerText = `${JSON.stringify(vv, null, 2)}`;

      break;
    }
  }
});
