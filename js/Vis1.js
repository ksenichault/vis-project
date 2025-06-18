import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const file = "./data/dpt2020.csv";
const startYear = 1990;
const endYear   = 2020;
const maxRowsPerGroup = 40; // Every group contains 40 rows
const topN = 400; // Top 400 names
let globalRawData = []; // Raw data for ranking charts
let globalStats = [];   // Processed data for matrix charts
let currentYear = 2020;


d3.dsv(";", file, d => ({
  sex: +d.sexe,
  name: d.preusuel,
  year: +d.annais,
  count: +d.nombre
}))
.then(raw => {
  raw = raw.filter(d => d.year >= startYear && d.year <= endYear && d.name !== '_PRENOMS_RARES');
  
  globalRawData = raw;

  const byNameYear = d3.rollup(
    raw,
    v => d3.sum(v, d => d.count),
    d => d.name,
    d => d.year
  );

  let stats = [];
  for (const [name, yearMap] of byNameYear) {
    const total = d3.sum(yearMap.values());
    const years = yearMap.size;
    stats.push({ name, total, years, yearMap });
  }

  stats = stats.sort((a, b) => d3.descending(a.total, b.total))
               .slice(0, topN);

  stats = stats.filter(d => d.years >= 10);

  stats.sort((a, b) => d3.ascending(a.name, b.name));
  
  globalStats = stats;
  
  initializeLeftPanel();
  
  const groups = [];
  for (let i = 0; i < stats.length; i += maxRowsPerGroup) {
    const group = stats.slice(i, i + maxRowsPerGroup);
    groups.push(group);
  }

  const select = d3.select("#groupSelect");
  select.selectAll("option")
        .data(groups)
        .join("option")
        .attr("value", (d, i) => i)
        .text((d, i) => {
          const first = d[0].name[0];
          const last  = d[d.length - 1].name[0];
          return `Group ${i+1}: ${first.toUpperCase()} - ${last.toUpperCase()} (${d.length} Names)`;
        });

  renderGroup(0);
  select.on("change", e => renderGroup(+e.target.value));

  // Matrix Charts
  function renderGroup(idx) {
    const data = groups[idx];
    const years = d3.range(startYear, endYear + 1);

    const containerWidth = document.getElementById('chartContainer').clientWidth || 900;
    const legendWidth = 15;
    const legendHeight = 150;
    const margin = { top: 30, right: 90, bottom: 15, left: 90 };
    
    const availableWidth = containerWidth - margin.left - margin.right - legendWidth - 10;
    const cellSize = Math.max(16, Math.min(12, Math.floor(availableWidth / years.length)));
    
    const width = Math.min(containerWidth, years.length * cellSize + margin.left + margin.right);
    const height = data.length * cellSize + margin.top + margin.bottom;

    const maxCount = d3.max(data, d => d3.max(years, y => d.yearMap.get(y) || 0));
    const color = d3.scaleSequential()
                    .domain([0, maxCount])
                    .interpolator(d3.interpolateBlues);

    d3.select("#chartContainer").selectAll("svg").remove();
    const svg = d3.select("#chartContainer")
                  .append("svg")
                  .attr("width", width)
                  .attr("height", height)
                  .style("border", "1px solid #e5e7eb")
                  .style("border-radius", "4px")
                  .style("background", "white")
                  .style("display", "block")
                  .style("margin", "0 auto");

    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
                        .attr("id", `vertical-gradient-${idx}`)
                        .attr("x1", "0%")
                        .attr("x2", "0%")
                        .attr("y1", "0%")
                        .attr("y2", "100%");

    gradient.selectAll("stop")
           .data(d3.range(0, 1.1, 0.1))
           .join("stop")
           .attr("offset", d => `${d * 100}%`)
           .attr("stop-color", d => color(maxCount * (1 - d)));

    const x = d3.scaleBand().domain(years).range([margin.left, width - margin.right]);
    const y = d3.scaleBand()
                .domain(data.map(d => d.name))
                .range([margin.top, height - margin.bottom]);

    // Cells
    svg.append("g")
       .selectAll("rect")
       .data(data.flatMap(d => years.map(yc => ({ name: d.name, year: yc, count: d.yearMap.get(yc) || 0 }))))
       .join("rect")
       .attr("x", d => x(d.year))
       .attr("y", d => y(d.name))
       .attr("width", cellSize - 0.5)
       .attr("height", cellSize - 0.5)
       .attr("fill", d => d.count === 0 ? "#f9fafb" : color(d.count))
       .attr("stroke", "white")
       .attr("stroke-width", 0.5)
       .style("cursor", "pointer")
       .on("mouseover", function(event, d) {
         const tooltip = d3.select("body")
           .append("div")
           .attr("class", "tooltip")
           .style("position", "absolute")
           .style("background", "rgba(0, 0, 0, 0.5)")
           .style("color", "white")
           .style("padding", "8px")
           .style("border-radius", "4px")
           .style("font-size", "12px")
           .style("pointer-events", "none")
           .style("z-index", "1000")
           .html(`Name: ${d.name}<br/>Year: ${d.year}<br/>Number: ${d.count}`);
         
         tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
       })
       .on("mousemove", function(event, d) {
         d3.select(".tooltip")
           .style("left", (event.pageX + 10) + "px")
           .style("top", (event.pageY - 10) + "px");
       })
       .on("mouseout", function() {
         d3.select(".tooltip").remove();
       });

    // Name Labels
    const nameFontSize = Math.max(8, Math.min(cellSize * 0.6, 12));
    svg.append("g")
       .attr("text-anchor", "end")
       .selectAll("text")
       .data(data)
       .join("text")
       .attr("x", margin.left - 6)
       .attr("y", d => y(d.name) + cellSize / 2)
       .attr("dy", "0.35em")
       .style("font-size", `${nameFontSize}px`)
       .style("fill", "#374151")
       .style("font-family", "Arial, sans-serif")
       .style("font-weight", "500")
       .text(d => d.name);

    // Year Labels
    const yearFontSize = Math.min(8, Math.min(cellSize * 0.7, 11));
    svg.append("g")
       .attr("text-anchor", "middle")
       .selectAll("text")
       .data(years.filter(y => y % 5 === 0))
       .join("text")
       .attr("x", d => x(d) + cellSize / 2)
       .attr("y", margin.top - 8)
       .style("font-size", `${yearFontSize}px`)
       .style("fill", "#6b7280")
       .style("font-family", "Arial, sans-serif")
       .style("font-weight", "500")
       .text(d => d);

    // Color Legend
    const legendX = width - margin.right + 30;
    // const legendY = margin.top + (height - margin.top - margin.bottom - legendHeight) / 2;
    const legendY = margin.top + 30;
    
    const legend = svg.append("g")
                     .attr("transform", `translate(${legendX}, ${legendY})`);

    legend.append("rect")
          .attr("width", legendWidth)
          .attr("height", legendHeight)
          .style("fill", `url(#vertical-gradient-${idx})`)
          .style("stroke", "#d1d5db")
          .style("stroke-width", 1);

    const legendScale = d3.scaleLinear()
                         .domain([maxCount, 0])
                         .range([0, legendHeight]);

    const legendAxis = d3.axisRight(legendScale)
                        .ticks(4)
                        .tickSize(3)
                        .tickFormat(d3.format(".0f"));

    const legendFontSize = Math.max(8, Math.min(cellSize * 0.6, 10));
    legend.append("g")
          .attr("transform", `translate(${legendWidth}, 0)`)
          .call(legendAxis)
          .selectAll("text")
          .style("font-size", `${legendFontSize}px`)
          .style("fill", "#374151")
          .style("font-family", "Arial, sans-serif");

    legend.append("text")
          .attr("x", legendWidth / 2)
          .attr("y", -10)
          .attr("text-anchor", "middle")
          .style("font-size", `${Math.max(9, legendFontSize + 1)}px`)
          .style("fill", "#374151")
          .style("font-weight", "bold")
          .style("font-family", "Arial, sans-serif")
          .text("Number");
  }
})
.catch(err => console.error(err));

// Ranking Charts
function initializeLeftPanel() {
  const yearSlider = d3.select("#yearSlider");
  const yearDisplay = d3.select("#yearDisplay");
  
  yearSlider
    .attr("min", startYear)
    .attr("max", endYear)
    .attr("step", 1)
    .attr("value", currentYear);

  yearDisplay.text(currentYear);
  
  yearSlider.on("input", function() {
    const selectedYear = +this.value;
    if (selectedYear !== currentYear) {
      currentYear = selectedYear;
      yearDisplay.text(currentYear);
      updateRankingCharts();
    }
  });
  
  updateRankingCharts();
}

function updateRankingCharts() {
  const yearData = d3.rollup(
    globalRawData.filter(d => d.year === currentYear),
    v => d3.sum(v, d => d.count),
    d => d.name
  );
  
  const rankingData = Array.from(yearData, ([name, count]) => ({ name, count }))
    .sort((a, b) => d3.descending(a.count, b.count));
  
  const topTen = rankingData.slice(0, 10);
  const bottomTen = rankingData.slice(-10).reverse();
  
  
  renderRankingChart("#topChart", topTen, "#1f77b4", "Top 10");
  renderRankingChart("#bottomChart", bottomTen, "#ff7f0e", "Bottom 10");

}

function renderRankingChart(containerId, data, color, title) {
  const container = d3.select(containerId);
  const containerNode = container.node().parentNode;
  
  if (!containerNode._cachedWidth) {
    containerNode._cachedWidth = containerNode.clientWidth || 400;
    containerNode._cachedHeight = containerNode.clientHeight || 300;
  }
  
  const containerWidth = containerNode._cachedWidth - 30;
  const containerHeight = containerNode._cachedHeight - 50;
  
  const margin = { top: 10, right: 40, bottom: 30, left: 80 };
  const width = containerWidth - margin.left - margin.right;
  const height = containerHeight - margin.top - margin.bottom;
  
  container.selectAll("*").remove();
  
  if (data.length === 0) {
    container.append("text")
      .attr("x", containerWidth / 2)
      .attr("y", containerHeight / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#6b7280")
      .style("font-size", "14px")
      .text(`No data for ${currentYear} ${title}`);
    return;
  }
  
  container.attr("width", containerWidth)
           .attr("height", containerHeight);
  
  const xScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.count)])
    .range([0, width]);
  
  const yScale = d3.scaleBand()
    .domain(data.map(d => d.name))
    .range([0, height])
    .padding(0.1);
  
  const g = container.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  
  g.selectAll(".bar")
    .data(data)
    .join("rect")
    .attr("class", "bar")
    .attr("x", 0)
    .attr("y", d => yScale(d.name))
    .attr("width", 0)
    .attr("height", yScale.bandwidth())
    .attr("fill", color)
    .attr("opacity", 0.8)
    .transition()
    .duration(500)
    .attr("width", d => xScale(d.count))
    .on("end", function() {
      d3.select(this)
        .on("mouseover", function(event, d) {
          d3.select(this).attr("opacity", 1);
          
          const tooltip = d3.select("body")
            .append("div")
            .attr("class", "ranking-tooltip")
            .style("position", "absolute")
            .style("background", "rgba(0, 0, 0, 0.8)")
            .style("color", "white")
            .style("padding", "8px 12px")
            .style("border-radius", "4px")
            .style("font-size", "12px")
            .style("pointer-events", "none")
            .style("z-index", "1000")
            .html(`${d.name}: ${d.count}`);
          
          tooltip.style("left", (event.pageX + 10) + "px")
                 .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", function() {
          d3.select(this).attr("opacity", 0.8);
          d3.select(".ranking-tooltip").remove();
        });
    });
  
  setTimeout(() => {
    g.selectAll(".label")
      .data(data)
      .join("text")
      .attr("class", "label")
      .attr("x", d => xScale(d.count) + 5)
      .attr("y", d => yScale(d.name) + yScale.bandwidth() / 2)
      .attr("dy", "0.35em")
      .style("font-size", "11px")
      .style("fill", "#374151")
      .style("font-weight", "500")
      .style("opacity", 0)
      .text(d => d.count)
      .transition()
      .duration(300)
      .style("opacity", 1);
  }, 300);
  
  const yAxis = d3.axisLeft(yScale)
    .tickSize(0)
    .tickPadding(8);
  
  g.append("g")
    .attr("class", "y-axis")
    .call(yAxis)
    .selectAll("text")
    .style("font-size", "11px")
    .style("fill", "#374151")
    .style("font-weight", "500");
  
  g.select(".y-axis .domain").remove();
  
  const xAxis = d3.axisBottom(xScale)
    .ticks(5)
    .tickSize(-height)
    .tickFormat(d3.format(".0f"));
  
  g.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height})`)
    .call(xAxis)
    .selectAll("text")
    .style("font-size", "10px")
    .style("fill", "#6b7280");
  
  g.selectAll(".x-axis .tick line")
    .style("stroke", "#e5e7eb")
    .style("stroke-dasharray", "2,2");
  
  g.select(".x-axis .domain").remove();
}