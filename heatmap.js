(function () {
  let template = document.createElement("template");
  template.innerHTML = `
  <style>
  g.tick {
    visibility: hidden;
  }
  path.domain{
    visibility: hidden;
  }
  
#my_dataviz #overlapping_message {
  position: fixed;
    bottom: 0px;
    z-index: 2;
    left: 10px;
    overflow: hidden;
    word-wrap: break-word;
    color: var(--sapTextColor);
    font-family: var(--sapFontFamily);
    font-size: var(--sapFontSize);
    background: var(--sapWarningBackground);
    border: 1px solid var(--sapWarningBorderColor);
    padding: 1em;
    cursor: pointer;
}
  #my_dataviz .cell, #my_dataviz .cell-container {
    width: inherit;
    height: inherit;
}
  #my_dataviz .cell-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    row-gap: 5px;
    justify-content: center;
    border: 2px solid;
    height: calc(100% - 4px);
}
#my_dataviz .headline{font-weight:600; order:1;font-size: 80% !important;}
  #my_dataviz .headline, #my_dataviz .sub-headline {
    
    overflow: hidden;
    margin: 0;
    text-align: center;
}
#my_dataviz .sub-headline {order:3;font-size: 60% !important;}
#my_dataviz figure img {
  max-width: 100%;
  max-height: 100%;
}
#my_dataviz figure{
  flex:1;
}
#my_dataviz .logo-container{
  order:2;
 display:flex;
 width:100%;
 height:20%;
 justify-content:center;
}
</style>

  <div id="my_dataviz"></div>

`;

  class Cell extends HTMLElement {
    constructor() {
      super();
      this._shadowRoot = this.attachShadow({ mode: "open" });
      this._shadowRoot.appendChild(template.content.cloneNode(true));
      this._props = {};

      const script = document.createElement("script");
      script.src = "https://d3js.org/d3.v4.js";
      script.addEventListener("load", () => {
        this._init();
      });
      this._shadowRoot.appendChild(script);
    }
    async _init() {
      this._props["ready"] = true;
      this._updateData(this.myDataBinding);
    }
    onCustomWidgetResize() {
      this._updateData(this.myDataBinding);
    }
    onCustomWidgetBeforeUpdate(changedProperties) {
      this._props = { ...this._props, ...changedProperties };
    }
    onCustomWidgetAfterUpdate(changedProperties) {
      if (this._props.ready) {
        this._updateData(this.myDataBinding);
      }
    }

    _transformDataV2(data) {
      const raw_data = data.data;
      if (!raw_data) return undefined; //TODO: ADD BETTER ERROR HANDLING
      const metadata = data.metadata;
      if (!metadata) return undefined; //TODO: ADD BETTER ERROR HANDLING
      const dimensions = metadata.dimensions;
      if (!dimensions) return undefined; //TODO: ADD BETTER ERROR HANDLING
      const measures = metadata.mainStructureMembers;
      if (!measures) return undefined; //TODO: ADD BETTER ERROR HANDLING

      // MERGE KEYS
      const merged_metadata = { ...dimensions, ...measures };

      const mapper = {
        "Cell Code": "",
        "SPAT_POS_X (KF)": "",
        "SPAT_POS_Y (KF)": "",
        "Cell Code Description": "",
        "Alert Type": "",
        "Alert Status (KF)": "",
        "Alert Status": "",
      };
      const reverse_mapper = {};
      for (const key of Object.keys(mapper)) {
        for (const meta_key of Object.keys(merged_metadata)) {
          const d = merged_metadata[meta_key];
          if (d.label === key || d.description === key) {
            mapper[key] = meta_key;
            reverse_mapper[meta_key] = key;
            break;
          }
        }
      }

      const new_data = [];
      for (const row of raw_data) {
        let new_row = {};
        for (const key of Object.keys(row)) {
          const d = row[key];
          let column = reverse_mapper[key];
          if (!column) {
            column = key;
          }
          new_row[column] = d;
        }

        new_data.push(new_row);
      }

      const first_row = new_data[0];
      if (first_row) {
        let required_fields = Object.keys(mapper);
        let all_required_fields_are_present = true;
        for (const key of required_fields) {
          if (!first_row[key]) {
            all_required_fields_are_present = false;
            break;
          }
        }

        if (!all_required_fields_are_present) {
          //TODO ERROR HANDLING
          return undefined;
        } else {
          let alerts = [];
          let cell_code_map = {};
          let spatial_data = [];
          for (const row of new_data) {
            let cell_code = row["Cell Code"].id;
            if (!cell_code_map[cell_code]) {
              spatial_data.push(row);
              cell_code_map[cell_code] = cell_code;
            }
            alerts.push(row);
          }
          return {
            alerts: alerts.filter(
              (alert) =>
                alert["Alert Status"].id !== "Cancelled" &&
                alert["Alert Status"].id !== "Finished"
            ),
            spatial_data,
          };
        }
      } else {
        return undefined;
      }
    }

    _updateData(data) {
      this._renderChart(data);
      // GREEN - RUNNING
      /****
       *
       * if (!dataBinding) {
        console.error("dataBinding is undefined");
      }
      if (!dataBinding || !dataBinding.data) {
        console.error("dataBinding.data is undefined");
      }

      if (this._ready) {
        // Check if dataBinding and dataBinding.data are defined
        if (dataBinding && Array.isArray(dataBinding.data)) {
          // Transform the data into the correct format

          this._renderChart(dataBinding.data);
        } else {
          console.error(
            "Data is not an array:",
            dataBinding && dataBinding.data
          );
        }
      }
       */
    }
    _showOverlappingCells(spatial_data) {
      let spatial_data_map = {};

      for (const row of spatial_data) {
        let spatial_key = `${row["SPAT_POS_X (KF)"].raw}:${row["SPAT_POS_Y (KF)"].raw}`;
        if (!spatial_data_map[spatial_key]) {
          spatial_data_map[spatial_key] = [];
        }
        spatial_data_map[spatial_key].push(row["Cell Code"].id);
      }
      let overlap_message = "";
      for (const key of Object.keys(spatial_data_map)) {
        let values = spatial_data_map[key];
        if (values.length > 1) {
          overlap_message += `<span>The following cells overlap at coordinates ( ${key} ) : ${values.map(v => `<b>${v}</b>`).join(
            ","
          )} </span>`;
        }
      }
      if (overlap_message) {
        let element = document.createElement("div");
        element.innerHTML = overlap_message;
        element.id = "overlapping_message";
        element.addEventListener("dblclick", (e) => {
          element.remove();
        });
        this._shadowRoot.getElementById("my_dataviz").appendChild(element);
      }
    }
    _renderChart(data) {
      if (!data) return;
      data = this._transformDataV2(data);
      if (!data) return;
      const { alerts, spatial_data } = data;
      console.log(alerts, spatial_data);
      const max = 10;
      const max_x = spatial_data.reduce((prev, curr) => {
        if (curr["SPAT_POS_X (KF)"].raw > prev)
          return curr["SPAT_POS_X (KF)"].raw;
        return prev;
      }, 0);
      const max_y = spatial_data.reduce((prev, curr) => {
        if (curr["SPAT_POS_Y (KF)"].raw > prev)
          return curr["SPAT_POS_Y (KF)"].raw;
        return prev;
      }, 0);

      // console.log(this.clientHeight, this.clientWidth, this.width);
      var margin = { top: 30, right: 30, bottom: 30, left: 30 },
        width = this.clientWidth - margin.left - margin.right,
        height = this.clientHeight - margin.top - margin.bottom;
      d3.select(this._shadowRoot.getElementById("my_dataviz"))
        .selectAll("*")
        .remove();
      var svg = d3
        .select(this._shadowRoot.getElementById("my_dataviz"))
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      var myGroups = Array.from(new Array(max_x)).map((_, index) => index);
      var myVars = Array.from(new Array(max_y)).map((_, index) => index);
      var x = d3.scaleBand().range([0, width]).domain(myGroups).padding(0.01);
      const xAxis = d3.axisBottom(x);
      xAxis.tickSize(0);
      svg
        .append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);

      // Build X scales and axis:
      var y = d3.scaleBand().range([height, 0]).domain(myVars).padding(0.01);
      const yAxis = d3.axisLeft(y);
      yAxis.tickSize(0);
      svg.append("g").call(yAxis);

      // FIRST RENDER ALL CELL CODES SPATIAL INFORMATION
      svg
        .selectAll()
        .data(spatial_data, function (d, i) {
          return (
            parseInt(d["SPAT_POS_X (KF)"].raw) +
            ":" +
            parseInt(d["SPAT_POS_Y (KF)"].raw) +
            ":" +
            i
          );
        })
        .enter()
        .append("foreignObject")
        .attr("x", function (d) {
          return x(parseInt(d["SPAT_POS_X (KF)"].raw));
        })
        .attr("y", function (d) {
          return y(parseInt(d["SPAT_POS_Y (KF)"].raw));
        })
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .append("xhtml:div")
        .attr("data-code", (d) => d["Cell Code"].id)
        .style("height", "100%")
        .html((d) => {
          return `<div class="cell"><div class="cell-container"><p class="headline"><span>${d["Cell Code Description"].label}</span></p><p class="sub-headline"><span>${d["Cell Code"].label}</span></p></div></div>`;
        })
        .style("background-color", function (d) {
          return "rgb(50 205 50)";
        });

      // SELECT HIGHEST ALERT STATUS AND RENDER LOGOS
      svg
        .selectAll("[data-code]")
        .style("background-color", function (d) {
          let cell_code = this.dataset.code;
          if (!cell_code) return "rgb(50 205 50)";
          let associated_alerts = alerts.filter(
            (a) => a["Cell Code"].id === cell_code
          );
          if (associated_alerts.length === 0) return "rgb(50 205 50)";
          let highest_alert_status = associated_alerts.reduce((prev, curr) => {
            let alert_status_key_figure = curr["Alert Status (KF)"].raw;
            if (alert_status_key_figure > prev) return alert_status_key_figure;
            else return prev;
          }, 0);
          if (highest_alert_status === 1) {
            this.setAttribute("data-finishedorcancelled", true);
          }
          let color = "rgb(50 205 50)";
          switch (highest_alert_status) {
            case 1:
              color = "rgb(50 205 50)";
              break;
            case 2:
              color = "rgb(255 215 0)";
              break;
            case 3:
              color = "rgb(255 215 0)";
              break;
            case 4:
              color = "rgb(165 42 42)";
              break;
            case 5:
              color = "rgb(255 0 0)";
              break;
          }
          return color;
        })
        .each(function () {
          let finishedOrCancelled = this.dataset.finishedorcancelled;
          if (finishedOrCancelled) return;
          let cell_code = this.dataset.code;
          if (!cell_code) return;
          let associated_alerts = alerts.filter(
            (a) => a["Cell Code"].id === cell_code
          );
          if (associated_alerts.length === 0) return;
          let alert_types = associated_alerts
            .filter((a) => a["Alert Status (KF)"].raw > 1)
            .map((a) => a["Alert Type"].id);
          let unique_alert_types = [...new Set(alert_types)];
          if (
            !Array.isArray(unique_alert_types) ||
            unique_alert_types.length == 0
          )
            return;
          let cell_container = this.querySelector(".cell-container");
          if (!cell_container) return;
          let images = "";
          for (const alert_type of unique_alert_types) {
            let imageSrc = "";

            switch (alert_type) {
              case "Changeover":
                imageSrc =
                  "https://github.com/external-ppavansai/customwidget/blob/main/MicrosoftTeams-image%20(changeover).svg";
                break;
              case "Maintenance":
                imageSrc =
                  "https://github.com/external-ppavansai/customwidget/blob/main/MicrosoftTeams-image%20(maintenance).svg";
                break;
              case "Quality":
                imageSrc =
                  "https://github.com/external-ppavansai/customwidget/blob/main/MicrosoftTeams-image%20(Quality).svg";
                break;
              case "Logistics":
                imageSrc =
                  "https://github.com/external-ppavansai/customwidget/blob/main/MicrosoftTeams-image%20(Logistics).svg";
                break;
            }

            images += `<img src="${imageSrc}"/>`;
          }
          if (!images) return;

          let dom = document.createElement("div");
          dom.classList.add("logo-container");
          dom.innerHTML = images;
          cell_container.appendChild(dom);
        });

      this._showOverlappingCells(spatial_data);
    }
  }

  customElements.define("production-heatmap", Cell);
})();
