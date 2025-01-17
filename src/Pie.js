import { csv, tsv, json } from 'd3-fetch';
import { mouse, select, selectAll } from 'd3-selection';
import { arc, pie } from 'd3-shape';
import rough from 'roughjs/bundled/rough.esm.js';
import get from 'lodash.get';
import Chart from './Chart';
import { colors } from './utils/colors';
import { addLegend } from './utils/addLegend';
import { roughCeiling } from './utils/roughCeiling';

class Pie extends Chart {
  constructor(opts) {
    super(opts);

    // load in arguments from config object
    // this.data = opts.data;
    this.margin = opts.margin || { top: 50, right: 20, bottom: 10, left: 20 };
    this.colors = get(opts, 'colors', colors);
    this.highlight = opts.highlight;
    this.roughness = roughCeiling({ roughness: opts.roughness, ceiling: 30, defaultValue: 0 });
    this.strokeWidth = get(opts, 'strokeWidth', 0.75);
    this.innerStrokeWidth = get(opts, 'innerStrokeWidth', 1);
    this.fillWeight = get(opts, 'fillWeight', 0.5);
    this.labels = (this.dataFormat === 'object') ? 'labels' : opts.labels;
    this.values = (this.dataFormat === 'object') ? 'values' : opts.values;
    if (this.labels === undefined || this.values === undefined) {
      console.log(`Error for ${this.el}: Must include labels and values when \
       instantiating Donut chart. Skipping chart.`);
      return;
    }
    this.legend = opts.legend !== false;
    this.legendPosition = get(opts, 'legendPosition', 'right');
    // new width
    this.initChartValues(opts);
    // resolve font
    this.resolveFont();
    // create the chart
    this.drawChart = this.resolveData(opts.data);
    this.drawChart();
    if (opts.title !== 'undefined') this.setTitle(opts.title);
  }

  initChartValues(opts) {
    const width = opts.width ? opts.width : 350;
    const height = opts.height ? opts.height : 450;
    this.width = width - this.margin.left - this.margin.right;
    this.height = height - this.margin.top - this.margin.bottom;
    this.roughId = this.el + '_svg';
    this.graphClass = this.el.substring(1, this.el.length);
    this.interactionG = 'g.' + this.graphClass;
    this.radius = Math.min(this.width, this.height) / 2;
    this.setSvg();
  }

  // add this to abstract base
  resolveData(data) {
    // if data from file, read in
    // else if data from json object, read in
    if (typeof data === 'string') {
      if (data.includes('.csv')) {
        return () => {
          csv(data).then(d => {
            console.log(d);
            this.data = d;
            this.drawFromFile();
          });
        };
      } else if (data.includes('.tsv')) {
        return () => {
          tsv(data).then(d => {
            console.log(d);
            this.data = d;
            this.drawFromFile();
          });
        };
      } else if (data.includes('.json')) {
        return () => {
          json(data).then((d) => {
            console.log(d);
            this.data = d;
            this.drawFromFile();
          });
        };
      }
    } else {
      return () => {
        this.data = data;
        this.drawFromObject();
      };
    }
  }

  setTitle(title) {
    this.svg.append('text')
      .attr('x', (this.width / 2))
      .attr('y', -10 - (this.margin.top / 3))
      .attr('class', 'title')
      .attr('text-anchor', 'middle')
      .style('font-size', (this.titleFontSize === undefined) ?
        `${Math.min(40, Math.min(this.width, this.height) / 4)}px` :
        this.titleFontSize)
      .style('font-family', this.fontFamily)
      .style('opacity', 0.8)
      .text(title);
  }

  addInteraction() {

    selectAll(this.interactionG)
      .append('g')
      .attr('transform', `translate(${this.width / 2}, ${this.height / 2})`)
      .data((this.dataFormat === 'object') ?
        this.makePie(this.data[this.values]) :
        this.makePie(this.data)
      )
      .append('path')
      .attr('d', this.makeArc)
      .attr('stroke-width', '0px')
      .attr('fill', 'transparent');


    // create tooltip
    const Tooltip = select(this.el)
      .append('div')
      .style('opacity', 0)
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('background-color', 'white')
      .style('border', 'solid')
      .style('border-width', '1px')
      .style('border-radius', '5px')
      .style('padding', '3px')
      .style('font-family', this.fontFamily)
      .style('font-size', this.tooltipFontSize)
      .style('pointer-events', 'none');

    // event functions
    var mouseover = function(d) {
      Tooltip
        .style('opacity', 1);
    };

    const that = this;
    let thisColor;

    var mousemove = function(d) {
      const attrX = select(this).attr('attrX');
      const attrY = select(this).attr('attrY');
      const mousePos = mouse(this);
      // get size of enclosing div
      Tooltip
        .html(`<b>${attrX}</b>: ${attrY}`)
        .style('opacity', 0.95)
        .attr('class', function(d) {
        })
        .style('transform', `translate(${mousePos[0] + that.margin.left}px, 
                            ${mousePos[1] - that.height - that.margin.bottom}px)`);
    };
    var mouseleave = function(d) {
      Tooltip
        .style('opacity', 0);
    };

    // d3 event handlers
    selectAll(this.interactionG)
      .on('mouseover', function() {
        mouseover();
        thisColor = select(this).selectAll('path').style('stroke');
        (that.highlight === undefined) ?
          select(this).selectAll('path').style('opacity', 0.5) :
          select(this).selectAll('path').style('stroke', that.highlight);
      });

    selectAll(this.interactionG)
      .on('mouseout', function() {
        mouseleave();
        select(this).selectAll('path').style('stroke', thisColor);
        select(this).selectAll('path').style('opacity', 1);
      });

    selectAll(this.interactionG)
      .on('mousemove', mousemove);
  }

  initRoughObjects() {
    this.roughSvg = document.getElementById(this.roughId);
    this.rcAxis = rough.svg(this.roughSvg, {options:
      {strokeWidth: this.strokeWidth >= 3 ? 3 : this.strokeWidth},
    });
    this.rc = rough.svg(this.roughSvg, {
      options: {
        fill: this.color,
        strokeWidth: this.innerStrokeWidth,
        roughness: this.roughness,
        bowing: this.bowing,
        fillStyle: this.fillStyle,
      },
    });
  }

  drawFromObject() {
    this.initRoughObjects();

    this.makePie = pie();

    this.makeArc = arc()
      .innerRadius(0)
      .outerRadius(this.radius);

    this.arcs = this.makePie(this.data[this.values]);

    this.arcs.forEach((d, i) => {
      if (d.value !== 0) {
        const node = this.rc.arc(
          this.width / 2, // x
          this.height / 2, // y
          2 * this.radius, // width
          2 * this.radius, // height
          d.startAngle - Math.PI / 2, // start
          d.endAngle - Math.PI / 2, // stop
          true, {
            fill: this.colors[i],
            stroke: this.colors[i],
          });
        node.setAttribute('class', this.graphClass);
        const roughNode = this.roughSvg.appendChild(node);
        roughNode.setAttribute('attrY', this.data[this.values][i]);
        roughNode.setAttribute('attrX', this.data[this.labels][i]);
      }
    });

    selectAll(this.interactionG).selectAll('path:nth-child(2)')
      .style('stroke-width', this.strokeWidth);

    const dataSources = this.data.labels;
    // ADD LEGEND
    const legendItems = dataSources.map((key, i) => ({
      color: this.colors[i],
      text: key,
    }));
    // find length of longest text item
    const legendWidth = legendItems.reduce(
      (pre, cur) => (pre > cur.text.length ? pre : cur.text.length),
      0,
    ) * 6 + 35;
    const legendHeight = legendItems.length * 11 + 8;

    if (this.legend === true) {
      addLegend(this, legendItems, legendWidth, legendHeight);
    };

    // If desired, add interactivity
    if (this.interactive === true) {
      this.addInteraction();
    }
  }

  drawFromFile() {
    this.initRoughObjects();

    this.makePie = pie()
      .value(d => d[this.values])
      .sort(null);

    const valueArr = [];
    this.makeArc = arc()
      .innerRadius(0)
      .outerRadius(this.radius);

    this.arcs = this.makePie(this.data);

    this.arcs.forEach((d, i) => {
      if (d.value !== 0) {
        // let c = this.makeArc.centroid(d);
        const node = this.rc.arc(
          this.width / 2, // x
          this.height / 2, // y
          2 * this.radius, // width
          2 * this.radius, // height
          d.startAngle - Math.PI / 2, // start
          d.endAngle - Math.PI / 2, // stop
          true, {
            fill: this.colors[i],
            stroke: this.colors[i],
          });
        node.setAttribute('class', this.graphClass);
        const roughNode = this.roughSvg.appendChild(node);
        roughNode.setAttribute('attrY', d.data[this.values]);
        roughNode.setAttribute('attrX', d.data[this.labels]);
      }
      valueArr.push(d.data[this.labels]);
    });


    selectAll(this.interactionG).selectAll('path:nth-child(2)')
      .style('stroke-width', this.strokeWidth);

    // ADD LEGEND
    const dataSources = valueArr;
    const legendItems = dataSources.map((key, i) => ({
      color: this.colors[i],
      text: key,
    }));
    // find length of longest text item
    const legendWidth = legendItems.reduce(
      (pre, cur) => (pre > cur.text.length ? pre : cur.text.length),
      0,
    ) * 6 + 35;
    const legendHeight = legendItems.length * 11 + 8;

    if (this.legend === true) {
      addLegend(this, legendItems, legendWidth, legendHeight);
    };

    // If desired, add interactivity
    if (this.interactive === true) {
      this.addInteraction();
    }

  } // draw

}

export default Pie;
