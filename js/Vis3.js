Promise.all([
  d3.json("df_plot.json"),
  d3.json("df_pct.json")
]).then(([df_plot, df_pct]) => {

  // SLIDER //
  const slider = d3.sliderBottom()
    .min(1900)
    .max(2020)
    .step(1)
    .width(400)
    .tickFormat(d3.format("d"))
    .ticks(10)
    .default(2000)
    .on('onchange', val => {
      d3.select("#yearLabel").text(val);
      d3.select("#barChartTitle").text(`Top 20 Unisex names for the year: ${val}`);
      drawBarChart(val);
    });

  d3.select("#slider")
    .append("svg")
    .attr("width", 460)
    .attr("height", 70)
    .append("g")
    .attr("transform", "translate(30,30)")
    .call(slider);

  // TEXT INPUT (autocompleted) //
  const nameInput = document.getElementById("nameInput");
  const suggestions = document.getElementById("suggestions");

  nameInput.addEventListener("input", () => {
    const query = nameInput.value.trim().toLowerCase();
    if (!query) return suggestions.innerHTML = "";
    
    const matches = allNames.filter(name => name.toLowerCase().startsWith(query));
    suggestions.innerHTML = "";
    matches.forEach(name => {
      const div = document.createElement("div");
      div.textContent = name;
      div.onclick = () => {
        nameInput.value = name;
        suggestions.innerHTML = "";
      };
      suggestions.appendChild(div);
    });
  });

  document.addEventListener("click", (e) => {
    if (!suggestions.contains(e.target) && e.target !== nameInput) {
      suggestions.innerHTML = "";
    }
  });

  d3.select("#addBtn").on("click", () => {
    const name = nameInput.value.trim();
    if (!name) return;
    if (!allNames.includes(name)) {
      alert(`Name "${name}" not found in data.`);
      return;
    }
    if (!selectedNames.has(name)) {
      selectedNames.add(name);
      drawLineChart();
      renderLineChartLegend();
      renderSelectedNames();
      updateBarOpacity();
    }
    nameInput.value = "";
    suggestions.innerHTML = "";
  });

  // SET UP //
  const barSvg = d3.select("#barChart"),
        lineSvg = d3.select("#lineChart");

  const margin = { top: 0, right: 50, bottom: 20, left: 70 };
  const width = +barSvg.attr("width") - margin.left - margin.right;
  const height = +barSvg.attr("height") - margin.top - margin.bottom;
  const barG = barSvg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const lineMargin = { top: 10, right: 20, bottom: 20, left: 75 };
  const lineWidth = +lineSvg.attr("width") - lineMargin.left - lineMargin.right;
  const lineHeight = +lineSvg.attr("height") - lineMargin.top - lineMargin.bottom;
  const lineG = lineSvg.append("g").attr("transform", `translate(${lineMargin.left}, ${lineMargin.top})`);
  
  const allNames = [...new Set(df_pct.map(d => d.preusuel))].sort();
  const selectedNames = new Set();

  // const nameList = d3.select("#nameList");
  // allNames.forEach(name => nameList.append("option").attr("value", name));

  // COLORS SETUP for line chart //
  const selectedColors = [
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080', '#ffffff', '#000000'
  ]; // i took this from https://sashamaps.net/docs/resources/20-colors/

  const color = d3.scaleOrdinal().domain(selectedNames).range(selectedColors);

  // SCALE SETUP
  const xScaleBar = d3.scaleLinear().range([0, width]);
  const yScaleBar = d3.scaleBand().range([0, height]).padding(0.1);

  const xScaleLine = d3.scaleLinear().domain([1900, 2020]).range([0, lineWidth]);
  const yScaleLine = d3.scaleLinear().domain([0, 1]).range([lineHeight, 0]);

  const line = d3.line().x(d => xScaleLine(d.annais)).y(d => yScaleLine(d.pct_male));

  // TOOLTIP
  const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
 

  // DRAW GRAPHS //

  // left graph
  const drawBarChart = (year) => {
    const filtered = df_plot.filter(d => d.annais === year);
    const ranked = Array.from(
      d3.rollup(filtered, v => d3.sum(v, d => d.total), d => d.preusuel),
      ([name, total]) => ({ name, total })
    ).sort((a, b) => d3.descending(a.total, b.total)).slice(0, 20);

    const topNames = new Set(ranked.map(d => d.name));
    const topData = filtered.filter(d => topNames.has(d.preusuel));
    const totalMap = new Map(ranked.map(d => [d.name, d.total]));

    const stacked = d3.groups(topData, d => d.preusuel).map(([name, entries]) => {
      const base = { name };
      entries.forEach(d => base[d.sex] = d.pct);
      return base;
    });

    yScaleBar.domain([...topNames]);
    xScaleBar.domain([0, 1]);

    barG.selectAll("*").remove();

    barG.append("g").call(d3.axisLeft(yScaleBar));
    barG.append("g").attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScaleBar).tickFormat(d3.format(".0%")));

    const bars = barG.selectAll(".bar")
      .data(stacked)
      .join("g")
      .attr("class", "bar")
      .attr("transform", d => `translate(0,${yScaleBar(d.name)})`)
      .on("click", (event, d) => {
        if (selectedNames.has(d.name)) {
          selectedNames.delete(d.name);
        } else {
          selectedNames.add(d.name);
        }
        drawLineChart();
        renderLineChartLegend();
        updateBarOpacity();
        renderSelectedNames();

        d3.selectAll(".bar-rect").classed("highlight", b => selectedNames.has(b.name));
      });

    bars.selectAll("rect").remove();

    bars.append("rect")
      .datum(d => ({ name: d.name, value: d.men || 0 }))
      .attr("class", "bar-rect")
      .attr("x", 0)
      .attr("height", yScaleBar.bandwidth())
      .attr("width", d => xScaleBar(d.value))
      .attr("fill", "purple")
      .attr("opacity", d => selectedNames.has(d.name) ? 1 : 0.3)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        tooltip.style("opacity", 1)
          .html(`<strong>Men:</strong> ${(d.value * 100).toFixed(1)}%`);
      })
      .on("mousemove", (event) => {
        tooltip.style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      });

    bars.append("rect")
      .datum(d => ({ name: d.name, value: d.women || 0, offset: d.men || 0 }))
      .attr("class", "bar-rect")
      .attr("x", d => xScaleBar(d.offset))
      .attr("height", yScaleBar.bandwidth())
      .attr("width", d => xScaleBar(d.value))
      .attr("fill", "red")
      .attr("opacity", d => selectedNames.has(d.name) ? 1 : 0.3)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        tooltip.style("opacity", 1)
          .html(`<strong>Women:</strong> ${(d.value * 100).toFixed(1)}%`);
      })
      .on("mousemove", (event) => {
        tooltip.style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      });

    bars.append("text")
      .attr("x", xScaleBar(1) + 5) 
      .attr("y", yScaleBar.bandwidth() / 2)
      .attr("dy", "0.35em")
      .text(d => {
        const total = totalMap.get(d.name);
        return total ? total.toLocaleString() : "";
      })
      .attr("font-size", "11px")
      .attr("fill", "black");

    barSvg.style("overflow", "visible");

    barSvg.selectAll(".x-axis-label").remove();

    barSvg.append("text")
      .attr("class", "x-axis-label")
      .attr("x", margin.left + width + 5) 
      .attr("y", margin.top - 3)
      .attr("text-anchor", "start")
      .attr("font-size", "10px")
      .attr("fill", "black")
      .text("Total Number of Births");

  };


  function updateBarOpacity() {
    d3.selectAll(".bar-rect")
      .attr("opacity", d => selectedNames.has(d.name) ? 1 : 0.3);
  }

  // middle graph
  function drawLineChart() {
    
    lineG.selectAll("*").remove();

    lineG.append("g")
      .attr("transform", `translate(0,${lineHeight})`)
      .call(d3.axisBottom(xScaleLine).ticks(10).tickFormat(d3.format("d")));


    lineG.append("g").call(d3.axisLeft(yScaleLine));

    selectedNames.forEach(name => {
      const data = df_pct.filter(d => d.preusuel === name && d.pct_male != null)
        .sort((a, b) => a.annais - b.annais);

      lineG.append("path")
        .datum(data)
        .attr("class", "line")
        .attr("stroke", color(name))
        .attr("fill", "none")
        .attr("stroke-width", 2)
        .attr("d", line);

      // x axis label: year
      lineG.append("text")
        .attr("text-anchor", "middle")
        .attr("x", lineWidth / 2)
        .attr("y", lineHeight + 40)  
        .attr("font-size", "12px")
        .text("Year");

      // y axis label: Proportion
      lineG.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", `translate(${-40},${lineHeight / 2}) rotate(-90)`) 
        .attr("font-size", "12px")
        .text("Proportion");

      // baseline
      lineG.append("line")
        .attr("x1", 0)
        .attr("x2", lineWidth)
        .attr("y1", yScaleLine(0.5))
        .attr("y2", yScaleLine(0.5))
        .attr("stroke", "gray")
        .attr("stroke-dasharray", "4 2") 
        .attr("stroke-width", 1);

      // Label for men at y = 1
      lineG.append("text")
        .attr("x", -30)  
        .attr("y", yScaleLine(1))
        .attr("dy", "0.35em")    
        .attr("text-anchor", "end")
        .attr("font-size", "12px")
        .attr("fill", "purple")  
        .text("Men");

      // Label for women at y = 0
      lineG.append("text")
        .attr("x", -30) 
        .attr("y", yScaleLine(0)) 
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .attr("font-size", "12px")
        .attr("fill", "red")    
        .text("Women");

      // this adds invisible dot targets to click on them, otherwise the line is too thin to click on it
      lineG.selectAll(`.click-target-${name}`)
        .data(data)
        .join("circle")
        .attr("class", `click-target-${name}`)
        .attr("cx", d => xScaleLine(d.annais))
        .attr("cy", d => yScaleLine(d.pct_male))
        .attr("r", 6)  
        .attr("fill", "transparent") // transparent dot
        .style("cursor", "pointer")
        .on("click", (event, d) => {
        
          drawHighlightDot(d.annais, d.pct_male);

          drawDetailChart(d.preusuel, d.annais);
        })
        // tooltip
        .on("mouseover", (event, d) => { 
          tooltip.style("opacity", 1)
            .html(`<strong>${d.preusuel}</strong><br/>Year: ${d.annais}<br/>Value: ${(d.pct_male * 100).toFixed(1)}%`);
        })
        .on("mousemove", (event) => {
          tooltip.style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => {
          tooltip.style("opacity", 0);
        });

    });
  };

  // Draw dot when we click on the line chart
  function drawHighlightDot(year, pct_male) {
    
    lineG.selectAll(".highlight-dot").remove();

    lineG.append("circle")
      .attr("class", "highlight-dot")
      .attr("cx", xScaleLine(year))
      .attr("cy", yScaleLine(pct_male))
      .attr("r", 5)
      .attr("fill", "red")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);
  }

  // DETAILED RATIO CHART (right chart)
  function drawDetailChart(name, year) { 
    const svg = d3.select("#detailChart");
    svg.selectAll("*").remove();

    const data = df_plot.filter(d => d.preusuel === name && d.annais === year);

    const male = data.find(d => d.sex === "men")?.pct || 0;
    const female = data.find(d => d.sex === "women")?.pct || 0;

    const margin = { top: 20, right: 0, bottom: 40, left: 40 };

    const width = +svg.attr("width") - margin.left - margin.right;
    const height = +svg.attr("height") - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().domain(["Men", "Women"]).range([0, width]).padding(0.4);
    const y = d3.scaleLinear().domain([0, 1]).range([height, 0]);

    g.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    g.append("g")
      .call(
        d3.axisLeft(y)
          .tickValues(d3.range(0, 1.01, 0.1))
    );

    g.selectAll(".bar").data([
      { label: "Men", value: male, color: "purple" },
      { label: "Women", value: female, color: "red" }
    ])
      .join("rect")
      .attr("x", d => x(d.label))
      .attr("y", d => y(d.value))
      .attr("width", x.bandwidth())
      .attr("height", d => height - y(d.value))
      .attr("fill", d => d.color);

    g.append("text")
      .attr("x", width / 2 - 10)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .text(`${name} in ${year}`);
  }


  function renderLineChartLegend() {
    const legend = d3.select("#legend");
    legend.selectAll("div").remove();

    selectedNames.forEach(name => {
      const div = legend.append("div");
      div.append("svg").attr("width", 20).attr("height", 10)
        .append("line")
        .attr("x1", 0).attr("x2", 20).attr("y1", 5).attr("y2", 5)
        .attr("stroke-width", 3).attr("stroke", color(name));
      div.append("span").text(name);
    });
  }

  function renderSelectedNames() { //TODO
    d3.select("#selectedNames").selectAll("span")
      .data(Array.from(selectedNames), d => d)
      .join(
        enter => enter.append("span")
          .text(d => d + " ✖")
          .on("click", (e, d) => {
            selectedNames.delete(d);
            drawLineChart();
            renderLineChartLegend();
            renderSelectedNames();
            updateBarOpacity();
          }),
        update => update.text(d => d + " ✖"),
        exit => exit.remove()
      );
  }

  // UPDATE LINE AND BAR GRAPHS ON TEXT INPUT
  d3.select("#nameInput").on("change", function () {
    const name = this.value;
    if (allNames.includes(name) && !selectedNames.has(name)) {
      selectedNames.add(name); // add the name to selected names
      drawLineChart();
      renderLineChartLegend();
      drawBarChart(+d3.select("#yearSlider").property("value"));
    }
    this.value = "";
  });

  // SELECTION ON SLIDER INPUT
  d3.select("#yearSlider").on("input", function () {
    const year = +this.value;
    d3.select("#yearLabel").text(year);
    drawBarChart(year); // changes the year 
  });


  // INITIALIZATION //
  selectedNames.add("CAMILLE");
  drawBarChart(2000); // first graph
  drawLineChart(); // second graph 
  
  // for selection update
  renderLineChartLegend(); 
  renderSelectedNames(); // selection
  updateBarOpacity();

});